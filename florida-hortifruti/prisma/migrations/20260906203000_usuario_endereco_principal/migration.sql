ALTER TABLE "usuarios"
ADD COLUMN "enderecoPrincipalId" TEXT;

CREATE UNIQUE INDEX "usuarios_enderecoPrincipalId_key" ON "usuarios"("enderecoPrincipalId");

ALTER TABLE "usuarios"
ADD CONSTRAINT "usuarios_enderecoPrincipalId_fkey"
FOREIGN KEY ("enderecoPrincipalId") REFERENCES "enderecos"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
