import { prisma } from './prisma.js'

const libraryGroupInclude = {
  options: { orderBy: { sortOrder: 'asc' } },
  categories: { include: { category: { select: { id: true, name: true } } } },
}

export async function applyLibraryGroupToProduct(productId, libraryGroup) {
  const existing = await prisma.modifierGroup.findFirst({
    where: { productId, externalId: libraryGroup.id },
  })

  const optionRows = libraryGroup.options.map((o) => ({
    externalId: o.id,
    name: o.name,
    price: o.price,
  }))

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.modifierOption.deleteMany({ where: { groupId: existing.id } })
      await tx.modifierGroup.update({
        where: { id: existing.id },
        data: {
          name: libraryGroup.name,
          required: libraryGroup.required,
          min: libraryGroup.min,
          max: libraryGroup.max,
          allowQuantity: libraryGroup.allowQuantity,
          options: { create: optionRows },
        },
      })
    })
    return
  }

  await prisma.modifierGroup.create({
    data: {
      externalId: libraryGroup.id,
      name: libraryGroup.name,
      required: libraryGroup.required,
      min: libraryGroup.min,
      max: libraryGroup.max,
      allowQuantity: libraryGroup.allowQuantity,
      productId,
      options: { create: optionRows },
    },
  })
}

export async function removeLibraryGroupFromProduct(productId, libraryGroupId) {
  await prisma.modifierGroup.deleteMany({
    where: { productId, externalId: libraryGroupId },
  })
}

/** Aplica a un producto todos los grupos de la biblioteca asignados a su categoría. */
export async function applyCategoryAssignmentsToProduct(categoryId, productId) {
  const assignments = await prisma.categoryModifierAssignment.findMany({
    where: { categoryId },
    include: {
      libraryGroup: { include: { options: { orderBy: { sortOrder: 'asc' } } } },
    },
  })
  for (const { libraryGroup } of assignments) {
    await applyLibraryGroupToProduct(productId, libraryGroup)
  }
}

export async function syncCategoryLibraryGroup(categoryId, libraryGroupId) {
  const libraryGroup = await prisma.modifierLibraryGroup.findUnique({
    where: { id: libraryGroupId },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!libraryGroup) throw new Error('Grupo no encontrado')

  const products = await prisma.product.findMany({ where: { categoryId }, select: { id: true } })
  for (const p of products) {
    await applyLibraryGroupToProduct(p.id, libraryGroup)
  }

  await prisma.categoryModifierAssignment.upsert({
    where: {
      categoryId_libraryGroupId: { categoryId, libraryGroupId },
    },
    create: { categoryId, libraryGroupId },
    update: {},
  })
}

export async function unsyncCategoryLibraryGroup(categoryId, libraryGroupId) {
  const products = await prisma.product.findMany({ where: { categoryId }, select: { id: true } })
  for (const p of products) {
    await removeLibraryGroupFromProduct(p.id, libraryGroupId)
  }
  await prisma.categoryModifierAssignment.deleteMany({
    where: { categoryId, libraryGroupId },
  })
}

export async function propagateLibraryGroupUpdate(libraryGroupId) {
  const libraryGroup = await prisma.modifierLibraryGroup.findUnique({
    where: { id: libraryGroupId },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!libraryGroup) return

  const productGroups = await prisma.modifierGroup.findMany({
    where: { externalId: libraryGroupId },
    select: { productId: true },
  })
  const productIds = [...new Set(productGroups.map((g) => g.productId))]
  for (const productId of productIds) {
    await applyLibraryGroupToProduct(productId, libraryGroup)
  }
}

export async function deleteLibraryGroupEverywhere(libraryGroupId) {
  await prisma.modifierGroup.deleteMany({ where: { externalId: libraryGroupId } })
  await prisma.categoryModifierAssignment.deleteMany({ where: { libraryGroupId } })
  await prisma.modifierLibraryGroup.delete({ where: { id: libraryGroupId } })
}

export async function buildLibraryResponse() {
  const groups = await prisma.modifierLibraryGroup.findMany({
    include: libraryGroupInclude,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  const productUsage = await prisma.modifierGroup.findMany({
    where: { externalId: { in: groups.map((g) => g.id) } },
    include: { product: { select: { id: true, name: true } } },
  })
  const usageByGroup = new Map()
  for (const pg of productUsage) {
    const list = usageByGroup.get(pg.externalId) || []
    if (!list.some((p) => p.id === pg.product.id)) {
      list.push({ id: pg.product.id, name: pg.product.name })
    }
    usageByGroup.set(pg.externalId, list)
  }

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    required: g.required,
    min: g.min,
    max: g.max,
    allowQuantity: g.allowQuantity,
    sortOrder: g.sortOrder,
    options: g.options.map((o) => ({ id: o.id, name: o.name, price: o.price })),
    usedByCategories: g.categories.map((a) => ({ id: a.category.id, name: a.category.name })),
    usedByProducts: usageByGroup.get(g.id) || [],
  }))
}

export async function importLibraryFromProducts() {
  const count = await prisma.modifierLibraryGroup.count()
  if (count > 0) return

  const groups = await prisma.modifierGroup.findMany({
    include: { options: true, product: { select: { id: true, categoryId: true } } },
    orderBy: { name: 'asc' },
  })
  if (!groups.length) return

  const byKey = new Map()
  for (const g of groups) {
    const key = g.externalId || g.name
    if (!byKey.has(key)) {
      byKey.set(key, {
        id: g.externalId || undefined,
        name: g.name,
        required: g.required,
        min: g.min,
        max: g.max,
        allowQuantity: g.allowQuantity,
        options: g.options.map((o) => ({ id: o.externalId, name: o.name, price: o.price })),
        productIds: new Set(),
        categoryCounts: new Map(),
      })
    }
    const entry = byKey.get(key)
    entry.productIds.add(g.product.id)
    const catId = g.product.categoryId
    entry.categoryCounts.set(catId, (entry.categoryCounts.get(catId) || 0) + 1)
  }

  for (const [key, entry] of byKey) {
    const lib = await prisma.modifierLibraryGroup.create({
      data: {
        ...(entry.id ? { id: entry.id } : {}),
        name: entry.name,
        required: entry.required,
        min: entry.min,
        max: entry.max,
        allowQuantity: entry.allowQuantity,
        options: {
          create: entry.options.map((o, i) => ({
            id: o.id && o.id.length > 8 ? o.id : undefined,
            name: o.name,
            price: o.price,
            sortOrder: i,
          })),
        },
      },
    })

    for (const [categoryId, matched] of entry.categoryCounts) {
      const total = await prisma.product.count({ where: { categoryId } })
      if (total > 0 && matched === total) {
        await prisma.categoryModifierAssignment.create({
          data: { categoryId, libraryGroupId: lib.id },
        })
      }
    }
  }
}
