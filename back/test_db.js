const { startDatabase, getDb } = require('./db');

async function testDatabase() {
  try {
    console.log('Starting database test...');
    
    // Inițializează baza de date
    const connected = await startDatabase();
    console.log('Database connected:', connected);
    
    if (!connected) {
      console.error('Could not connect to database');
      return;
    }
    
    // Obține instanța bazei de date
    const db = getDb();
    console.log('Database instance:', db ? 'OK' : 'NULL');
    
    if (!db) {
      console.error('getDb() returned null');
      return;
    }
    
    // Testează o query simplă
    const result = await db.get('SELECT COUNT(*) as count FROM programare');
    console.log('Programări count:', result);
    
    // Testează query-ul pentru medicul 1
    const programari = await db.all(`
      SELECT p.id_programare, p.data, p.ora, p.status, p.detalii,
             pa.nume || ' ' || pa.prenume as nume_pacient,
             pa.telefon
      FROM programare p
      LEFT JOIN pacient pa ON p.id_pacient = pa.id_pacient
      WHERE p.id_medic = 1
      ORDER BY p.data DESC, p.ora DESC
    `);
    
    console.log('Programări pentru medicul 1:', programari.length);
    if (programari.length > 0) {
      console.log('Prima programare:', programari[0]);
    }
    
  } catch (err) {
    console.error('Error in test:', err);
  }
}

testDatabase(); 