import prisma from '../src/utils/prisma';
import { decryptField } from '../src/utils/encryption.util';

async function main() {
  console.log('Iniciando reversión de encriptación para full_name...');
  const users = await prisma.user.findMany({
    where: { 
        full_name: { not: null } 
    }
  });

  let count = 0;
  for (const user of users) {
    if (user.full_name) {
      const decrypted = decryptField(user.full_name);
      
      // Solo actualizar si realmente era una cadena encriptada (si cambió después de intentar desencriptar, o si es válido)
      // decryptField retorna el mismo texto si falla al desencriptar o no parece base64
      if (decrypted && decrypted !== user.full_name) {
        await prisma.user.update({
          where: { id: user.id },
          data: { full_name: decrypted }
        });
        count++;
        console.log(`full_name desencriptado para el usuario ${user.email}.`);
      }
    }
  }

  console.log(`Reversión finalizada. Se arreglaron los nombres de ${count} usuarios.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
