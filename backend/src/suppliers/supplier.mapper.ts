interface SupplierRecord {
  id: bigint;
  name: string;
  contactPerson: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function mapSupplierToResponse(supplier: SupplierRecord) {
  return {
    id: Number(supplier.id),
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    isActive: supplier.isActive,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  };
}
