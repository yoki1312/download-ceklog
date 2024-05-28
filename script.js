const { Pool } = require('pg'); 
const mysql = require('mysql2');
const collect = require('collect.js');

const koneksiDatabasePSG = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'perol',
    password: 'yoki1312',
    port: 5432,
});

const koneksiDatabaseSMO = mysql.createPool({
    host: '52.74.55.188',
    user: 'itdevelop',
    password: 'W#qb<^?XjF9]Ju=[',
    database: 'smartone_trimega',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

let idExited = null;

koneksiDatabaseSMO.getConnection((err, connection) => {
    if (err) {
        console.error('Error getting connection from pool:', err);
        return;
    }

    let karyawan = [];
    connection.query('SELECT id_karyawan, nip FROM m_karyawan where deleted_at is null', (err, results, fields) => {
        connection.release();

        if (err) {
            console.error('Error executing query:', err);
            return;
        }
        karyawan = results;
    });

    connection.query('SELECT att_id, id_karyawan FROM t_log_absen', (err, results, fields) => {
        connection.release();

        if (err) {
            console.error('Error executing query:', err);
            return;
        }

        let pluckResultByID = collect(results).pluck('att_id').all();
        
        if(pluckResultByID.length > 0){
            idExited = pluckResultByID.join(','); 
        }else{
            idExited = 0;
        }
        // console.log(karyawan,);
        downloadData(idExited,karyawan);
    });
});

async function downloadData(idExited,karyawan) { 
    const query = `SELECT
	tb.pegnik as nip,
    TO_CHAR( masuk, 'yyyy-mm-dd' ) as tanggal,
	ta.masuk,
	ta.keluar,
	ta.idtrxabsen as att_id
FROM
	perol.trxabsen ta
	INNER JOIN perol.maspeg tb ON tb.idmaspeg = ta.rel_maspeg 
WHERE
	masuk >= '2024-05-20' 
	AND ta.masuk IS NOT NULL 
	AND ta.keluar IS NOT NULL 
    and ta.idtrxabsen not in (${idExited})`; 
    
    try {
        const client = await koneksiDatabasePSG.connect();
        console.log('Connected to PostgreSQL');

        const result = await client.query(query);
        let dataArr = collect(result.rows).map(function(r){
            let dataKaryawan = collect(karyawan).where('nip', r.nip).first();
            r.id_karyawan = (dataKaryawan != null ? dataKaryawan.id_karyawan : null);
            return r;
        }).all();    
        await insertData(dataArr);
        client.release(); 
    } catch (error) {
        console.error('Error in downloadData:', error);
    } finally { 
        process.exit();
    }
}

async function insertData(dataArray) {
    if (dataArray.length === 0) {
        console.log('No data to insert.');
        return;
    }

    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO t_log_absen (tanggal,absen_in, absen_out,nip, id_karyawan,att_id) VALUES ?';
        const values = dataArray.map(data => [data.tanggal, data.masuk, data.keluar, data.nip, data.id_karyawan, data.att_id]);

        console.log('Inserting data:', values);

        koneksiDatabaseSMO.query(sql, [values], (err, results) => {
            if (err) {
                console.error('Error inserting data:', err.stack);
                reject(err);
                return;
            }
            console.log('Data inserted successfully:', results);
            resolve(results);
        });
    });
}
