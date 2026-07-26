-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "allowed_extensions" TEXT[] DEFAULT ARRAY['.pdf', '.md', '.txt']::TEXT[],
ADD COLUMN     "blocked_topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "min_team_size" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "project_sections" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "obligatoria" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_sections_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "project_sections" ADD CONSTRAINT "project_sections_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

