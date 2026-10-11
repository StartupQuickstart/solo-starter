import { PrismaLikeClient } from '../database';
import { Backend } from '../index';
import { BaseModel } from './base.model';

export class UserModel<T extends PrismaLikeClient = PrismaLikeClient> extends BaseModel<T, any> {
  constructor(backend: Backend<T>) {
    super(backend, {
      tableName: 'user',
      // Explicit, so a deleted account is never found again by provisioning:
      // someone who signs up again with the same email starts a new account.
      softDelete: true,
      searchFields: ['email', 'firstName', 'lastName'],
      defaultOrderBy: { createdAt: 'desc' },
    });
  }
}
