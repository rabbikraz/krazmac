-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shiur" (
    "id" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "blurb" TEXT,
    "audioUrl" TEXT NOT NULL,
    "sourceDoc" TEXT,
    "pubDate" TIMESTAMP(3) NOT NULL,
    "duration" TEXT,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shiur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformLinks" (
    "id" TEXT NOT NULL,
    "shiurId" TEXT NOT NULL,
    "youtube" TEXT,
    "youtubeMusic" TEXT,
    "spotify" TEXT,
    "apple" TEXT,
    "amazon" TEXT,
    "pocket" TEXT,
    "twentyFourSix" TEXT,
    "castbox" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformLinks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Shiur_guid_key" ON "Shiur"("guid");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformLinks_shiurId_key" ON "PlatformLinks"("shiurId");

-- AddForeignKey
ALTER TABLE "PlatformLinks" ADD CONSTRAINT "PlatformLinks_shiurId_fkey" FOREIGN KEY ("shiurId") REFERENCES "Shiur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
