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
import { MunicipioMail, MunicipiosMailsAdminService, MunicipioMailPayload } from '../../../services/municipios-mails-admin.service';
import { MunicipioSelectOption, MunicipioService } from '../../../services/municipio.service';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-municipio-mail-dialog',
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
  templateUrl: './municipio-mail-dialog.component.html',
  styleUrls: ['./municipio-mail-dialog.component.scss']
})

export class MunicipioMailDialogComponent implements OnInit {
  form!: FormGroup;
  enviando: boolean = false;
  cargandoMunicipios: boolean = false;
  municipios: MunicipioSelectOption[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly municipiosMailsAdminService: MunicipiosMailsAdminService,
    private readonly municipiosService: MunicipioService,
    private readonly dialogRef: MatDialogRef<MunicipioMailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: MunicipioMail | null
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      municipio_id: new FormControl({ value: this.data?.municipio_id || '', disabled: this.deshabilitarCampos }, [Validators.required]),
      nombre: new FormControl({ value: this.data?.nombre || '', disabled: false }, [Validators.required, Validators.maxLength(255)]),
      email: new FormControl({ value: this.data?.email || '', disabled: this.deshabilitarCampos }, [Validators.required, Validators.email]),
    });
    this.cargarMunicipios();
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

    if(!this.data?.municipio_id){
      const emailValue = this.form.value.email
      const municipioValue = this.municipios.find(m => m.municipio_id === this.form.value.municipio_id)?.municipio_nombre
      Swal.fire({
        title: 'Confirmar envío',
        text: `¿Confirmás crear el mail "${emailValue}" para el municipio "${municipioValue}"? Una vez creado no podrás modificar el email.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, enviar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d'
      }).then((result) => {
        if(result.isConfirmed){
          this.enviarSolicitud()
        }
      })
    }else{
      this.enviarSolicitud()
    }
  }

  private construirPayload(formValue: any): MunicipioMailPayload {
    const normalizarString = (valor: unknown): string | null => {
      if (valor === null || valor === undefined) {
        return null;
      }
      const limpio = String(valor).trim();
      return limpio.length > 0 ? limpio : null;
    };

    const payload: MunicipioMailPayload = {
      municipio_id: Number(formValue.municipio_id ?? this.data?.municipio_id ?? 0),
      email: normalizarString(formValue.email) ?? '',
      nombre: normalizarString(formValue.nombre) ?? '',
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

  private enviarSolicitud(): void {
    const payload = this.construirPayload(this.form.value);
    this.enviando = true;
    const request$ = this.data?.municipio_id
      ? this.municipiosMailsAdminService.actualizarMunicipioMail(this.data.municipio_id, this.data.email, payload)
      : this.municipiosMailsAdminService.crearMunicipioMail(payload);

    request$
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: () => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: this.data?.municipio_id ? 'Mail del municipio actualizado' : 'Mail del municipio creado',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
            background: '#f0fdf4',
            color: '#14532d'
          });
          this.dialogRef.close(true);
        },
        error: (error) => {
          const message = this.resolveErrorMessage(error, 'No se pudo guardar el mail del municipio.');
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

  private cargarMunicipios(): void {
    this.cargandoMunicipios = true;
    this.municipiosService
      .getCatalogoMunicipios()
      .subscribe({
        next: (municipios) => {
          this.municipios = municipios ?? []
        },
        error: (error) => {
          console.error('Error obteniendo catálogo de municipios', error);
        },
        complete: () => {
          this.cargandoMunicipios = false;
        }
      });
  }

  get deshabilitarCampos(): boolean {
    return this.data !== null && this.data?.municipio_id !== null && this.data?.email !== null
  }
}
