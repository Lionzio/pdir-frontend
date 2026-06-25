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

  private requiredPermissions: string[] = [];
  private hasView = false;

  @Input() set appRbacAllow(permissions: string[]) {
    this.requiredPermissions = permissions;
    this.updateView();
  }

  constructor() {
    effect(() => {
      this.authService.permissions();
      this.updateView();
    });
  }

  private updateView(): void {
    const hasMatch = this.requiredPermissions.some((perm) => this.authService.hasPermission(perm));

    if (hasMatch && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasMatch && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
