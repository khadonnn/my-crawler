-- CreateTable
CREATE TABLE "Proxy" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "protocol" TEXT NOT NULL DEFAULT 'http',
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "latency" INTEGER NOT NULL DEFAULT 0,
    "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proxy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proxy_address_port_key" ON "Proxy"("address", "port");
