import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
})
export class ForgotPasswordComponent implements OnInit {
  form!: FormGroup;
  loading = false;

  constructor(private fb: FormBuilder, private auth: AuthService) { }

  ngOnInit(): void {
    // Inicializa el formulario con disabled controlado por la variable `loading`
    this.form = this.fb.group({
      usuario: [{ value: '', disabled: this.loading }, [Validators.required, Validators.minLength(3)]],
    });
  }

  solicitarBlanqueo() {
    if (this.form.invalid) return;

    const usuario = this.form.get('usuario')?.value;
    this.loading = true;
    this.form.get('usuario')?.disable(); // 🔒 Deshabilita el campo mientras se procesa

    this.auth.requestPasswordResetByUser(usuario).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.form.get('usuario')?.enable(); // 🔓 Rehabilita el campo

        const correoParcial = res.maskedEmail || 'tu correo registrado';

        Swal.fire({
          icon: 'success',
          title: 'Solicitud enviada',
          html: `Se envió un correo a tu casilla <b>${correoParcial}</b>. Revisá tu bandeja de entrada.`,
          confirmButtonColor: '#2b3e4c',
        });
      },
      error: (err) => {
        this.loading = false;
        this.form.get('usuario')?.enable();

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.error?.error || 'No se pudo procesar la solicitud.',
          confirmButtonColor: '#2b3e4c',
        });
      },
    });
  }
}
