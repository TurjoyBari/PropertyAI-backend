import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ObjectId } from 'mongodb';
import { UserRole } from '../common/enums';

@Injectable()
export class AccountService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async setSignupRole(userId: string, role: 'user' | 'agent') {
    if (!ObjectId.isValid(userId)) {
      throw new NotFoundException('User not found');
    }

    const nextRole = role === 'agent' ? UserRole.AGENT : UserRole.USER;
    const result = await this.connection.collection('user').findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { role: nextRole, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

    if (!result) {
      throw new NotFoundException('User not found');
    }

    return {
      id: String(result._id),
      role: result.role as string,
    };
  }
}
