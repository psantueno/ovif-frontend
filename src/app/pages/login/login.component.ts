import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

// Servicio de autenticación
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  errorMessage = '';
  loading = false;

  form = this.fb.group({
    usuario: ['', Validators.required],  
    password: ['', Validators.required]
  });

  onLogin() {
    if (this.form.invalid) return;

    this.loading = true;
    const { usuario, password } = this.form.value;

    this.auth.login(usuario!, password!).subscribe({
      next: () => {
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Error en login:', err);
        this.errorMessage = err.error?.error || 'Error de autenticación';
        this.loading = false;
      }
    });
  }
}
