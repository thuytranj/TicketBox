import { DataSource, type DataSourceOptions } from 'typeorm';
import type { SeederOptions } from 'typeorm-extension';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Fix for ES Module scope where __dirname is undefined
const baseDir = typeof __dirname !== 'undefined' ? __dirname : path.join(process.cwd(), 'src/data');

dotenv.config({ path: path.resolve(baseDir, '../../../../.env') });

export const ormConfig: DataSourceOptions & SeederOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [path.join(baseDir, '../**/*.entity{.ts,.js}')],
  migrations: [path.join(baseDir, 'migrations/*{.ts,.js}')],
  seeds: [path.join(baseDir, 'seeds/**/*{.ts,.js}')],
  factories: [path.join(baseDir, 'factories/**/*{.ts,.js}')],
  synchronize: false,
};

const dataSource = new DataSource(ormConfig);
export default dataSource;
