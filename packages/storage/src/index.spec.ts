import { describe, it, expect } from 'vitest';
import { InMemoryRepository, DatabaseMigrator } from './index.js';

interface UserEntity {
  id: string;
  name: string;
}

describe('Storage Abstractions & Migrations', () => {
  it('should store and retrieve data in InMemoryRepository', async () => {
    const repo = new InMemoryRepository<UserEntity>();
    await repo.put({ id: 'user-1', name: 'John Doe' });

    const user = await repo.get('user-1');
    expect(user?.name).toBe('John Doe');

    const list = await repo.list();
    expect(list.length).toBe(1);

    await repo.delete('user-1');
    const deletedUser = await repo.get('user-1');
    expect(deletedUser).toBeUndefined();
  });

  it('should run migrator upgrade steps sequentially', () => {
    const migrator = new DatabaseMigrator();
    let migrationRunCount = 0;

    migrator.registerMigration(1, (_db) => {
      migrationRunCount += 1;
    });

    migrator.registerMigration(2, (_db) => {
      migrationRunCount += 1;
    });

    const dummyDb = {} as IDBDatabase;
    migrator.migrate(dummyDb, 0, 2);

    expect(migrationRunCount).toBe(2);
  });
});
