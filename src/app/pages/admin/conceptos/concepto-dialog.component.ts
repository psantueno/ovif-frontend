import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelect, MatOption } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
import { Concepto, ConceptosAdminService, ConceptoPayload } from '../../../services/conceptos-admin.service';
import { PartidaRecursoService, PartidaRecursoSelectOption } from '../../../services/partida-recurso.service';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-concepto-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelect,
    MatOption,
    LoadingOverlayComponent
  ],
  templateUrl: './concepto-dialog.component.html',
  styleUrls: ['./concepto-dialog.component.scss']
})

export class ConceptoDialogComponent implements OnInit {
  form!: FormGroup;
  enviando: boolean = false;
  cargandoPartidas: boolean = false;
  partidasRecurso: PartidaRecursoSelectOption[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly conceptoAdminService: ConceptosAdminService,
    private readonly partidaRecursoService: PartidaRecursoService,
    private readonly dialogRef: MatDialogRef<ConceptoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: Concepto | null
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      cod_concepto: new FormControl({ value: this.data?.cod_concepto || '', disabled: !this.conceptoModificable  || (this.data?.cod_concepto !== 0 && this.data?.cod_concepto !== undefined)}, [Validators.required]),
      descripcion: new FormControl({ value: this.data?.descripcion || '', disabled: !this.conceptoModificable }, [Validators.required, Validators.maxLength(255)]),
      cod_recurso: new FormControl({ value: this.data?.cod_recurso || '', disabled: !this.conceptoModificable })
    });
    this.cargarPartidasRecursos();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'Revisá los campos obligatorios',
        showConfirmButton: false,
        timer: 2200
      });
      return;
    }

    const payload = this.construirPayload(this.form.value);
    this.enviando = true;
    const request$ = this.data?.cod_concepto
      ? this.conceptoAdminService.actualizarConcepto(this.data.cod_concepto, payload)
      : this.conceptoAdminService.crearConcepto(payload);

    request$
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: () => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: this.data?.cod_concepto ? 'Concepto actualizado' : 'Concepto creado',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
            background: '#f0fdf4',
            color: '#14532d'
          });
          this.dialogRef.close(true);
        },
        error: (error) => {
          const message = this.resolveErrorMessage(error, 'No se pudo guardar el concepto.');
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: message,
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
            background: '#fee2e2',
            color: '#7f1d1d'
          });
        }
      });
  }

  get conceptoModificable(){
    if(this.data?.modificable !== undefined && this.data?.modificable !== null){
      return this.data?.modificable
    }

    return true;
  }

  private construirPayload(formValue: any): ConceptoPayload {
    const normalizarString = (valor: unknown): string | null => {
      if (valor === null || valor === undefined) {
        return null;
      }
      const limpio = String(valor).trim();
      return limpio.length > 0 ? limpio : null;
    };

    const payload: ConceptoPayload = {
      cod_concepto: Number(formValue.cod_concepto ?? this.data?.cod_concepto ?? 0),
      descripcion: normalizarString(formValue.descripcion) ?? '',
      cod_recurso: formValue.cod_recurso ? Number(formValue.cod_recurso) : null
    }

    return payload;
  }

  private resolveErrorMessage(error: any, fallback: string): string {
    if (error?.error) {
      const err = error.error.error;
      if (typeof err === 'string' && err.trim().length > 0) {
        return err;
      }
      if (typeof err?.message === 'string' && err.message.trim().length > 0) {
        return err.message;
      }
    }

    if (typeof error?.message === 'string' && error.message.trim().length > 0) {
      return error.message;
    }

    return fallback;
  }

    private cargarPartidasRecursos(): void {
    this.cargandoPartidas = true;
    this.partidaRecursoService
      .getCatalogoPartidasRecursos()
      .subscribe({
        next: (partidas) => {
          this.partidasRecurso = partidas ?? []
        },
        error: (error) => {
          console.error('Error obteniendo catálogo de convenio', error);
        },
        complete: () => {
          this.cargandoPartidas = false;
        }
      });
  }
}
