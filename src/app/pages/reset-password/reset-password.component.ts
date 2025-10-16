import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon'; // por si luego querés íconos

import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    templateUrl: './reset-password.component.html',
    styleUrls: ['./reset-password.component.scss'],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatIconModule,],
})
export class ResetPasswordComponent implements OnInit {
    form!: FormGroup;
    token: string = '';
    loading = false;

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private auth: AuthService
    ) { }

    ngOnInit(): void {
  this.token = this.route.snapshot.queryParamMap.get('token') || '';

  if (!this.token) {
    Swal.fire({
      icon: 'warning',
      title: 'Enlace inválido',
      text: 'El enlace para restablecer la contraseña no es válido.',
      confirmButtonColor: '#2b3e4c',
    }).then(() => this.router.navigate(['/login']));
    return;
  }

  this.form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });
}


    resetPassword() {
        if (this.form.invalid) return;

        const { password, confirm } = this.form.value;

        if (password !== confirm) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'Las contraseñas no coinciden.',
                confirmButtonColor: '#2b3e4c',
            });
            return;
        }

        this.loading = true;

        this.auth.confirmPasswordReset(this.token, password).subscribe({
            next: (res: any) => {
                this.loading = false;
                Swal.fire({
                    icon: 'success',
                    title: 'Contraseña actualizada',
                    text: 'Tu nueva contraseña fue guardada correctamente.',
                    confirmButtonColor: '#2b3e4c',
                }).then(() => this.router.navigate(['/login']));
            },
            error: (err) => {
                this.loading = false;

                let msg = 'No se pudo restablecer la contraseña.';
                const code = err.error?.code;

                if (code === 'TOKEN_EXPIRED') msg = 'El enlace expiró. Solicitá uno nuevo.';
                else if (code === 'TOKEN_USED') msg = 'Este enlace ya fue utilizado.';
                else if (code === 'INVALID_TOKEN') msg = 'El enlace no es válido.';

                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: msg,
                    confirmButtonColor: '#2b3e4c',
                });
            },
        });
    }
}
