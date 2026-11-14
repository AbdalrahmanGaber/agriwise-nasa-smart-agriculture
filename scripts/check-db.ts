import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()
p.savedAnalysis
  .findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, label: true, bestCrop: true, createdAt: true } })
  .then((rows) => {
    console.log('total saved analyses visible in DB check (last 5):', rows.length)
    rows.forEach((r) => console.log(` - ${r.createdAt.toISOString()} | ${r.label} | ${r.bestCrop}`))
    return p.savedAnalysis.count()
  })
  .then((c) => console.log('TOTAL:', c))
  .then(() => p.$disconnect())
  .catch((e) => {
    console.error('DB ERROR:', e.message.slice(0, 300))
    process.exit(1)
  })
