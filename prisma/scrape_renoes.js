const fs = require('fs');

const BASE_FILTER = '%7B%22sector%22%3A%5B%5D%2C%22nivel_educativo%22%3A%5B%5D%2C%22modalidad%22%3A%5B%5D%2C%22estado%22%3A%5B%5D%2C%22tipo_ies%22%3A%5B%5D%2C%22espacios%22%3A%22%22%2C%22extranjero%22%3A%22%22%2C%22string_like%22%3A%22%22%7D';
const BASE_URL = 'https://renoes.sep.gob.mx';

// Utility for concurrency
async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);
    if (poolLimit <= array.length) {
      const e = p.then(() => {
          executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

async function scrapeRenoes() {
  console.log('Iniciando extracción de carreras desde RENOES...');
  
  // 1. Fetch all careers
  let careersData;
  try {
    const res = await fetch(`${BASE_URL}/show/0/20000/${BASE_FILTER}/0`);
    careersData = await res.json();
  } catch (error) {
    console.error('Error fetching careers:', error);
    return;
  }
  
  const careers = careersData.results_carreras.rows;
  console.log(`Se encontraron ${careers.length} carreras en total.`);
  
  const universitiesMap = new Map();
  
  let completed = 0;
  let total = careers.length;

  const fetchInstitutions = async (career) => {
    const id_carrera = career.id_carrera;
    const careerName = career.carrera;
    
    let retries = 3;
    while(retries > 0) {
        try {
            const res = await fetch(`${BASE_URL}/showListadoByCarrera/0/1000/${id_carrera}/${BASE_FILTER}/0`);
            const data = await res.json();
            const institutions = data.results.rows;
            
            for (const inst of institutions) {
                const uniName = inst.more_info.b;
                if (!uniName) continue;
                
                // Clean the name
                const cleanName = uniName.trim().toUpperCase();
                
                if (!universitiesMap.has(cleanName)) {
                    universitiesMap.set(cleanName, new Set());
                }
                universitiesMap.get(cleanName).add(careerName.trim().toUpperCase());
            }
            break; // Success
        } catch (error) {
            retries--;
            if (retries === 0) {
                console.error(`\nError fetching institutions for career ID ${id_carrera}:`, error);
            }
            await new Promise(r => setTimeout(r, 2000)); // wait 2s before retry
        }
    }
    
    completed++;
    if (completed % 100 === 0) {
        process.stdout.write(`\rProgreso: ${completed} / ${total} carreras procesadas...`);
    }
  };
  
  // 2. Fetch institutions concurrently (Limit 15 to be safe)
  console.log('Obteniendo instituciones por cada carrera (esto tomará unos minutos)...');
  await asyncPool(15, careers, fetchInstitutions);
  
  console.log('\nProcesamiento terminado. Formateando resultados...');
  
  // 3. Format to JSON Array
  const finalResults = [];
  for (const [uniName, careersSet] of universitiesMap.entries()) {
      finalResults.push({
          name: uniName,
          careers: Array.from(careersSet)
      });
  }
  
  // Save to JSON
  fs.writeFileSync('./prisma/renoes_universities_careers.json', JSON.stringify(finalResults, null, 2));
  console.log(`¡Extracción completada con éxito! Se guardaron ${finalResults.length} universidades y sus carreras en prisma/renoes_universities_careers.json.`);
}

scrapeRenoes();
