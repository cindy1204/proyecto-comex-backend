import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError } from '../../src/application/errors/conflict.error.js';
import { NotFoundError } from '../../src/application/errors/not-found.error.js';
import { UnauthorizedError } from '../../src/application/errors/unauthorized.error.js';
import { AuthUseCase } from '../../src/application/use-cases/auth.use-case.js';
import { createInMemoryInfrastructure } from '../support/in-memory.js';

describe('AuthUseCase', () => {
  let infra: ReturnType<typeof createInMemoryInfrastructure>;
  let auth: AuthUseCase;

  beforeEach(() => {
    infra = createInMemoryInfrastructure();
    auth = new AuthUseCase(infra.users, infra.passwords, infra.tokens);
  });

  it('registra siempre con rol user y devuelve usuario, token y expiresIn', async () => {
    const session = await auth.register({ name: 'Ana', email: 'ana@test.com', password: 'Secreta#123' });

    expect(session.user).toMatchObject({ name: 'Ana', email: 'ana@test.com', role: 'user' });
    expect(session.user).not.toHaveProperty('passwordHash');
    expect(session.token).toBeTruthy();
    expect(session.expiresIn).toBe(3600);
  });

  it('no guarda la contraseña en claro', async () => {
    await auth.register({ name: 'Ana', email: 'ana@test.com', password: 'Secreta#123' });

    expect(infra.users.users[0]?.passwordHash).not.toBe('Secreta#123');
  });

  it('rechaza un correo duplicado con 409', async () => {
    await auth.register({ name: 'Ana', email: 'ana@test.com', password: 'Secreta#123' });

    await expect(auth.register({ name: 'Otra', email: 'ana@test.com', password: 'Otra#12345' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('crea administradores solo mediante registerAdmin', async () => {
    const admin = await auth.registerAdmin({ name: 'Root', email: 'root@test.com', password: 'Administrador#1' });

    expect(admin.role).toBe('admin');
  });

  it('inicia sesión con credenciales válidas', async () => {
    await auth.register({ name: 'Ana', email: 'ana@test.com', password: 'Secreta#123' });

    const session = await auth.login({ email: 'ana@test.com', password: 'Secreta#123' });

    expect(session.user.email).toBe('ana@test.com');
  });

  it.each([
    ['contraseña incorrecta', 'ana@test.com', 'incorrecta'],
    ['correo inexistente', 'nadie@test.com', 'Secreta#123'],
  ])('responde 401 con mensaje genérico ante %s', async (_case, email, password) => {
    await auth.register({ name: 'Ana', email: 'ana@test.com', password: 'Secreta#123' });

    await expect(auth.login({ email, password })).rejects.toMatchObject({
      status: 401,
      message: 'Credenciales inválidas.',
    });
  });

  it('ejecuta passwords.compare aunque el usuario no exista, contra un hash bcrypt falso', async () => {
    const compare = vi.spyOn(infra.passwords, 'compare');

    await expect(auth.login({ email: 'nadie@test.com', password: 'Secreta#123' })).rejects.toMatchObject({
      status: 401,
      message: 'Credenciales inválidas.',
    });

    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare).toHaveBeenCalledWith('Secreta#123', expect.stringMatching(/^\$2[aby]\$12\$/));
  });

  it('no inicia sesión con el hash falso aunque la contraseña coincida con él', async () => {
    vi.spyOn(infra.passwords, 'compare').mockResolvedValue(true);

    await expect(auth.login({ email: 'nadie@test.com', password: 'x' })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('autentica un token vigente con el rol de la base de datos', async () => {
    const { user, token } = await auth.register({ name: 'Ana', email: 'ana@test.com', password: 'Secreta#123' });
    const stored = infra.users.users[0];
    if (stored) stored.role = 'admin';

    await expect(auth.authenticate(token)).resolves.toEqual({ id: user.id, role: 'admin' });
  });

  it('rechaza un token inválido o de un usuario eliminado con 401', async () => {
    const { user, token } = await auth.register({ name: 'Ana', email: 'ana@test.com', password: 'Secreta#123' });

    await expect(auth.authenticate('token-falso')).rejects.toBeInstanceOf(UnauthorizedError);

    infra.users.delete(user.id);
    await expect(auth.authenticate(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('devuelve el perfil y 404 si el usuario no existe', async () => {
    const { user } = await auth.register({ name: 'Ana', email: 'ana@test.com', password: 'Secreta#123' });

    await expect(auth.getProfile(user.id)).resolves.toMatchObject({ id: user.id, email: 'ana@test.com' });
    await expect(auth.getProfile('cinexistente')).rejects.toBeInstanceOf(NotFoundError);
  });
});
