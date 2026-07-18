import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { UserRole } from '../common/enums';

@Injectable()
export class AdminUsersService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private users() {
    return this.connection.collection('user');
  }

  async listUsers() {
    const rows = await this.users()
      .find({})
      .project({
        name: 1,
        email: 1,
        role: 1,
        emailVerified: 1,
        createdAt: 1,
        image: 1,
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return {
      items: rows.map((row) => ({
        id: String(row._id),
        name: row.name,
        email: row.email,
        role: row.role ?? UserRole.USER,
        emailVerified: Boolean(row.emailVerified),
        createdAt: row.createdAt,
        image: row.image,
      })),
    };
  }

  async updateRole(userId: string, role: UserRole, actorRole: string) {
    if (actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can change roles');
    }
    if (![UserRole.ADMIN, UserRole.AGENT, UserRole.USER].includes(role)) {
      throw new ForbiddenException('Invalid role');
    }

    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(userId)) throw new NotFoundException('User not found');

    const result = await this.users().findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { role, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

    if (!result) throw new NotFoundException('User not found');

    return {
      id: String(result._id),
      name: result.name,
      email: result.email,
      role: result.role,
    };
  }
}
