import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Usuario } from './usuarios.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface Municipio {
  municipio_id: number;
  municipio_nombre: string;
}

@Component({
  selector: 'app-usuarios-dialog',
  standalone: true, // ✅ lo hacemos standalone
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './usuarios-dialog.component.html',
  styleUrls: ['./usuarios-dialog.component.scss'],
})
export class UsuariosDialogComponent implements OnInit {
  form!: FormGroup;
  municipios: Municipio[] = [];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<UsuariosDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Usuario | null
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      usuario: [this.data?.usuario || '', Validators.required],
      email: [this.data?.email || '', [Validators.required, Validators.email]],
      nombre: [this.data?.nombre || '', Validators.required],
      apellido: [this.data?.apellido || '', Validators.required],
      password: [''], // solo al crear
      municipios: [this.data?.municipios || []],
      activo: [this.data?.activo ?? true],
    });

    this.cargarMunicipios();
  }

  cargarMunicipios() {
    // 🔹 Simulación, en producción vendría del backend
    this.municipios = [
      { municipio_id: 1, municipio_nombre: 'Neuquén' },
      { municipio_id: 2, municipio_nombre: 'Cutral Có' },
      { municipio_id: 3, municipio_nombre: 'Zapala' },
    ];
  }

  guardar() {
    if (this.form.invalid) return;

    const usuario: Usuario = {
      ...this.data,
      ...this.form.value,
    };

    this.dialogRef.close(usuario);
  }
}
