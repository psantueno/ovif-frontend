import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Usuario } from '../../../services/usuarios.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { UsuariosService } from '../../../services/usuarios.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-usuarios-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './usuarios-dialog.component.html',
  styleUrls: ['./usuarios-dialog.component.scss'],
})
export class UsuariosDialogComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private usuariosService: UsuariosService,
    public dialogRef: MatDialogRef<UsuariosDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Usuario | null
  ) {}

  ngOnInit(): void {
  this.form = this.fb.group({
    usuario: [this.data?.usuario || '', Validators.required],
    email: [this.data?.email || '', [Validators.required, Validators.email]],
    nombre: [this.data?.nombre || '', Validators.required],
    apellido: [this.data?.apellido || '', Validators.required],
    password: [
      '', 
      !this.data?.usuario ? Validators.required : [] // ✅ solo requerido al crear
    ],
    activo: [this.data?.activo ?? true],
  });
}

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'Completa los campos obligatorios',
        showConfirmButton: false,
        timer: 2000,
      });
      return;
    }

    const formValue = this.form.value;

    if (this.data?.usuario_id) {
      // 🔹 Editar usuario
      this.usuariosService.updateUsuario(this.data.usuario_id, formValue).subscribe({
        next: () => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Usuario actualizado correctamente',
            showConfirmButton: false,
            timer: 1800,
          });
          this.dialogRef.close(true);
        },
        error: (err) => {
          Swal.fire('Error', err.error?.error || 'Error actualizando usuario', 'error');
        },
      });
    } else {
      // 🔹 Crear usuario
      this.usuariosService.createUsuario(formValue).subscribe({
        next: () => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Usuario creado correctamente',
            showConfirmButton: false,
            timer: 1800,
          });
          this.dialogRef.close(true);
        },
        error: (err) => {
          Swal.fire('Error', err.error?.error || 'Error creando usuario', 'error');
        },
      });
    }
  }
}
