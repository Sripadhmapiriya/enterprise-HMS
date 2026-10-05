import React, { ReactNode } from 'react';

export interface PermissionGateProps {
  permission: string;
  userPermissions?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  permission,
  userPermissions = [],
  fallback = null,
  children,
}: PermissionGateProps) {
  const isSuperAdmin = userPermissions.includes('*');
  const hasDirectPermission = userPermissions.includes(permission);

  // Check wildcards like "patients.*" or "pharmacy.dispense.*"
  const hasWildcardPermission = userPermissions.some((userPerm) => {
    if (userPerm.endsWith('.*')) {
      const prefix = userPerm.slice(0, -2);
      return permission.startsWith(prefix);
    }
    return false;
  });

  const isAllowed = isSuperAdmin || hasDirectPermission || hasWildcardPermission;

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
