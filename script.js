const { Pool } = require('pg'); 
const mysql = require('mysql2');
const collect = require('collect.js');
var moment = require('moment');
let dateNowMin = moment().subtract(1, 'days').format('YYYY-MM-DD');

const koneksiDatabasePSG = new Pool({
    user: 'a141',
    host: 'localhost',
    database: 'perol',
    password: 'yoki1312',
    port: 5432,
});

console.log(dateNowMin);

const koneksiDatabaseSMO = mysql.createPool({
    host: '52.74.55.188',
    user: 'itdevelop',
    password: 'W#qb<^?XjF9]Ju=[',
    database: 'smartone_trimega',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

let dataExited = null;

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

    connection.query('SELECT att_id, id_karyawan, absen_in, absen_out FROM t_log_absen', (err, results, fields) => {
        connection.release();

        if (err) {
            console.error('Error executing query:', err);
            return;
        }

        dataExited = results;
        
        downloadData(dataExited,karyawan);
    });
});

async function downloadData(dataExited,karyawan) { 

    let notInAtt = 0;
    if(dataExited.length > 0){
        let pluckDataExited = collect(dataExited).pluck('att_id').all();
        notInAtt = pluckDataExited.join(',');
    }
    const query = `SELECT tb.pegnik as nip, TO_CHAR( masuk, 'yyyy-mm-dd' ) as tanggal, ta.masuk, ta.keluar, ta.idtrxabsen as att_id FROM perol.trxabsen ta INNER JOIN perol.maspeg tb ON tb.idmaspeg = ta.rel_maspeg WHERE masuk >= '${dateNowMin}'`; 
    
    try {
        const client = await koneksiDatabasePSG.connect();
        console.log('Connected to PostgreSQL');

        const result = await client.query(query);

        let dataInsert = [];
        let dataUpdated = [];
        result.rows.forEach(async element => {
            let dataKaryawan = collect(karyawan).where('nip', element.nip);
            let id_karyawan = 0;
            if(dataKaryawan.count() > 0){
                let row = dataKaryawan.first();
                id_karyawan = row.id_karyawan;
            }
            element.id_karyawan = id_karyawan;

            let cekData = collect(dataExited).where('att_id', element.att_id).first();
            if(cekData == undefined){
                if(cekData.absen_out != null && cekData.absen_in != null){
                    dataInsert.push(element);
                }
            }else{
                if(element.keluar != null){
                    dataUpdated.push(element);
                }
            }
        });
        if(dataInsert.length > 0){
            await insertData(dataInsert);
        }else{
            await updateBatchData(dataUpdated);

        }    
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


        koneksiDatabaseSMO.query(sql, [values], (err, results) => {
            if (err) {
                console.error('Error inserting data:', err.stack);
                reject(err);
                return;
            }
            resolve(results);
        });
    });
}

async function updateBatchData(dataArray) {
    
    if (dataArray.length === 0) {
        console.log('No data to updated.');
        return;
    }
    return new Promise((resolve, reject) => {
        let sql = 'UPDATE t_log_absen SET absen_out = ? WHERE att_id = ?';
    
        const updatePromises = dataArray.map(data => {
            const { keluar, att_id } = data;
    
            return new Promise((resolve, reject) => {
                koneksiDatabaseSMO.query(sql, [keluar, att_id], (err, results) => {
                    if (err) {
                        console.error('Error updating data:', err.stack);
                        reject(err);
                        return;
                    }
                    resolve(results);
                });
            });
        });

        Promise.all(updatePromises)
            .then(results => {
                console.log('All data updated successfully');
                resolve(results);
            })
            .catch(err => {
                console.error('Error updating data:', err.stack);
                reject(err);
            });
    });
    
  }
