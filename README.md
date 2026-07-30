# Authentication & Identity Service — Corvus Platform

Este microservicio pertenece al ecosistema de la plataforma **CORVUS** (Sistema Integrador de Proyectos y Gestión Académica con IA). Es el núcleo encargado de la **gestión de identidad, autenticación, autorización y catálogos institucionales**.

---

## 🎯 Función en el Ecosistema CORVUS
* **Autenticación Multi-rol:** Gestión de usuarios con roles estrictos (`ADMINISTRADOR`, `PROFESOR`, `ALUMNO`).
* **Seguridad y JWT:** Emisión y verificación de tokens de acceso JWT.
* **Catálogos Institucionales:** Gestión de Universidades (Catálogo RENOES), Carreras y Habilidades (`skills`).
* **Base de Datos Dedicada:** Opera sobre su base de datos PostgreSQL aislada **`corvus_auth_db`**.

---

## ⚙️ Tecnologías
* **Lenguaje & Framework:** Node.js, Express, TypeScript.
* **ORM:** Prisma ORM.
* **Base de Datos:** PostgreSQL (`corvus_auth_db`).
* **Seguridad:** Bcrypt, JWT.

---

## 🛠️ Ejecución Local Independiente

### 1. Variables de Entorno
Crea un archivo `.env` basado en `.env.example`:
```env
PORT=3001
DATABASE_URL="postgresql://corvus_user:password@localhost:5432/corvus_auth_db?schema=public"
JWT_SECRET="your_jwt_secret"
```

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Migraciones y Seeding de Datos
```bash
# Ejecutar migraciones de Prisma
npx prisma migrate dev

# Cargar roles, usuarios administradores y catálogo RENOES
npx prisma db seed
```

### 4. Iniciar Servidor en Desarrollo
```bash
npm run dev
```
El servicio estará disponible localmente en `http://localhost:3001`.

---

## 🐳 Ejecución con Docker

```bash
docker build -t corvus-auth-service .
docker run -p 3001:3001 --env-file .env corvus-auth-service
```

---

## 🔗 Integración con la Orquestación de CORVUS
En producción o entorno completo de desarrollo, este microservicio es orquestado por **`orchestration-back-corvus`** mediante `docker compose` y expuesto a través del **API Gateway** (`/api/v1/auth`).
