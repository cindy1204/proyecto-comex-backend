import type { AuthenticatedUser } from '../domain/models/user.model.js';

export function isOwnerOrAdmin(viewer: AuthenticatedUser, ownerId: string | null): boolean {
  return viewer.role === 'admin' || (ownerId !== null && ownerId === viewer.id);
}
