import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, from, map, of, switchMap, throwError } from 'rxjs';

const JSON_MIME_FRAGMENT = 'json';
const TEXT_MIME_PREFIX = 'text/';

function shouldDecodeBlobPayload(payload: Blob): boolean {
  const mimeType = payload.type ?? '';
  if (!mimeType) {
    return true;
  }

  return mimeType.includes(JSON_MIME_FRAGMENT) || mimeType.startsWith(TEXT_MIME_PREFIX);
}

function parseBlobTextPayload(rawText: string): unknown {
  if (!rawText) {
    return rawText;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

export function normalizeBlobHttpError(error: unknown): Observable<never> {
  if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) {
    return throwError(() => error);
  }

  if (!shouldDecodeBlobPayload(error.error)) {
    return throwError(() => error);
  }

  return from(error.error.text()).pipe(
    map((rawText) => {
      if (!rawText) {
        return error;
      }

      return new HttpErrorResponse({
        error: parseBlobTextPayload(rawText),
        headers: error.headers,
        status: error.status,
        statusText: error.statusText,
        url: error.url ?? undefined,
      });
    }),
    catchError(() => of(error)),
    switchMap((normalizedError) => throwError(() => normalizedError))
  );
}
