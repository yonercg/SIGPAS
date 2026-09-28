export const actividades = [
  {
    id: 1,
    fecha: "2026-08-18",
    nombre: "Inspección de equipos de patio",
    subestacion: "Subestación Acacías",
    cuadrillaId: "C1",
    responsable: "Ingeniero Carlos",
    estado: "Ejecutada",
  },
  {
    id: 2,
    fecha: "2026-08-19",
    nombre: "Mantenimiento preventivo",
    subestacion: "Subestación Guamal",
    cuadrillaId: "C2",
    responsable: "Ingeniero José",
    estado: "Pendiente",
  },
  {
    id: 3,
    fecha: "2026-08-20",
    nombre: "Revisión de protecciones",
    subestacion: "Subestación Granada",
    cuadrillaId: "C3",
    responsable: "Ingeniero Andrés",
    estado: "Reprogramada",

    // Conservamos la fecha original
    fechaOriginal: "2026-08-20",

    // Motivo de reprogramación
    motivoReprogramacion:
      "Actividad pendiente de coordinación con la cuadrilla.",
  },
  {
    id: 4,
    fecha: "2026-08-21",
    nombre: "Pruebas de transformador",
    subestacion: "Subestación Acacías",
    cuadrillaId: "C4",
    responsable: "Ingeniero José",
    estado: "Ejecutada",
  },
];