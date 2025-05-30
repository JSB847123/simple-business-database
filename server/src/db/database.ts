import sqlite3 from 'sqlite3';
import { Database as SqliteDB } from 'sqlite3';
import { Location, LocationQuery } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class Database {
  private db: SqliteDB;

  constructor(dbPath: string = process.env.DATABASE_PATH || './database.sqlite') {
    this.db = new sqlite3.Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    const createLocationsTable = `
      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        address_and_name TEXT NOT NULL,
        location_type TEXT,
        check_items TEXT,
        floors_data TEXT NOT NULL,
        notes TEXT,
        timestamp INTEGER NOT NULL,
        last_saved INTEGER,
        user_id TEXT,
        created_at INTEGER DEFAULT (datetime('now')),
        updated_at INTEGER DEFAULT (datetime('now'))
      )
    `;

    const createPhotosTable = `
      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        floor_id TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT,
        file_key TEXT,
        size INTEGER,
        timestamp INTEGER NOT NULL,
        created_at INTEGER DEFAULT (datetime('now')),
        FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
      )
    `;

    this.db.serialize(() => {
      this.db.run(createLocationsTable);
      this.db.run(createPhotosTable);
    });
  }

  // Location CRUD operations
  async createLocation(location: Location): Promise<Location> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO locations (
          id, address_and_name, location_type, check_items, 
          floors_data, notes, timestamp, last_saved, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        location.id || uuidv4(),
        location.address.addressAndName,
        location.locationType || null,
        location.checkItems || null,
        JSON.stringify(location.floors),
        location.notes || null,
        location.timestamp,
        location.lastSaved || Date.now(),
        location.userId || null
      ];

      this.db.run(query, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ ...location, id: values[0] as string });
        }
      });
    });
  }

  async getLocations(query: LocationQuery = {}): Promise<Location[]> {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM locations WHERE 1=1';
      const params: any[] = [];

      if (query.locationType) {
        sql += ' AND location_type = ?';
        params.push(query.locationType);
      }

      if (query.search) {
        sql += ' AND address_and_name LIKE ?';
        params.push(`%${query.search}%`);
      }

      if (query.startDate) {
        sql += ' AND timestamp >= ?';
        params.push(new Date(query.startDate).getTime());
      }

      if (query.endDate) {
        sql += ' AND timestamp <= ?';
        params.push(new Date(query.endDate).getTime());
      }

      sql += ' ORDER BY timestamp DESC';

      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(query.limit);
        
        if (query.page && query.page > 1) {
          sql += ' OFFSET ?';
          params.push((query.page - 1) * query.limit);
        }
      }

      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const locations = rows.map(row => ({
            id: row.id,
            address: { addressAndName: row.address_and_name },
            locationType: row.location_type,
            checkItems: row.check_items,
            floors: JSON.parse(row.floors_data),
            notes: row.notes,
            timestamp: row.timestamp,
            lastSaved: row.last_saved,
            userId: row.user_id
          }));
          resolve(locations);
        }
      });
    });
  }

  async getLocationById(id: string): Promise<Location | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM locations WHERE id = ?',
        [id],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            resolve({
              id: row.id,
              address: { addressAndName: row.address_and_name },
              locationType: row.location_type,
              checkItems: row.check_items,
              floors: JSON.parse(row.floors_data),
              notes: row.notes,
              timestamp: row.timestamp,
              lastSaved: row.last_saved,
              userId: row.user_id
            });
          }
        }
      );
    });
  }

  async updateLocation(id: string, location: Partial<Location>): Promise<Location | null> {
    return new Promise((resolve, reject) => {
      const updates: string[] = [];
      const params: any[] = [];

      if (location.address?.addressAndName) {
        updates.push('address_and_name = ?');
        params.push(location.address.addressAndName);
      }

      if (location.locationType !== undefined) {
        updates.push('location_type = ?');
        params.push(location.locationType);
      }

      if (location.checkItems !== undefined) {
        updates.push('check_items = ?');
        params.push(location.checkItems);
      }

      if (location.floors) {
        updates.push('floors_data = ?');
        params.push(JSON.stringify(location.floors));
      }

      if (location.notes !== undefined) {
        updates.push('notes = ?');
        params.push(location.notes);
      }

      updates.push('last_saved = ?');
      params.push(Date.now());

      params.push(id);

      const query = `UPDATE locations SET ${updates.join(', ')} WHERE id = ?`;

      this.db.run(query, params, (err) => {
        if (err) {
          reject(err);
        } else {
          this.getLocationById(id).then(resolve).catch(reject);
        }
      });
    });
  }

  async deleteLocation(id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM locations WHERE id = ?', [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  // Close database connection
  close(): void {
    this.db.close();
  }
} 