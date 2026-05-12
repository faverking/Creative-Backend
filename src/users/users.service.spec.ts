import { UserStatus } from '../common/enums/user-status.enum';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('returns only public-facing fields for public profile queries', async () => {
    const user = {
      id: '507f1f77bcf86cd799439011',
      email: 'person@example.com',
      name: 'Public User',
      status: UserStatus.ACTIVE,
      roles: ['user'],
      avatarUrl: 'avatars/user.png',
      bio: 'Visible bio',
      lastLoginAt: new Date('2026-04-01T10:00:00.000Z'),
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      updatedAt: new Date('2026-04-01T10:00:00.000Z'),
    };
    const usersRepository = {
      findById: jest.fn().mockResolvedValue(user),
    };
    const service = new UsersService(usersRepository as never);

    await expect(service.getPublicProfileById(user.id)).resolves.toEqual({
      id: user.id,
      name: user.name,
      avatarUrl: 'avatars/user.png',
      bio: user.bio,
    });
    expect(usersRepository.findById).toHaveBeenCalledWith(user.id);
  });
});
