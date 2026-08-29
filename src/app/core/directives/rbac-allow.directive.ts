import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject } from '@angular/core';

import { AuthSignalService } from '../services/auth-signal.service';

@Directive({
  selector: '[appRbacAllow]',
  standalone: true,
})
export class RbacAllowDirective {
  private templateRef = inject(TemplateRef);
  private viewContainer = inject(ViewContainerRef);
  private authService = inject(AuthSignalService);

  private allowedRoles: string[] = [];
  private hasView = false;

  @Input() set appRbacAllow(roles: string[]) {
    this.allowedRoles = roles;
    console.log('SETTER CALLED WITH', roles);
    this.updateView();
  }

  constructor() {
    effect(() => {
      // Rastreia o Signal role() — qualquer mudança (login, logout, troca de role)
      // dispara reavaliação automática da visibilidade do template.
      this.authService.role();
      this.updateView();
    });
  }

  private updateView(): void {
    const authorized = this.authService.hasRole(this.allowedRoles);

    if (authorized && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!authorized && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
