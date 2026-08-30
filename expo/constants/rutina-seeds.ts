export interface SeedExercise {
  name: string;
  videoUrl: string;
  muscleGroup: string;
  equipment: string;
  difficulty: 'principiante' | 'intermedio' | 'avanzado';
  notes?: string;
}

export const SEED_EXERCISES: SeedExercise[] = [
  // Pecho
  { name: 'Press Banca', videoUrl: '', muscleGroup: 'Pecho', equipment: 'Barra', difficulty: 'intermedio', notes: 'Bajá la barra a la línea del pecho, codos a 45°.' },
  { name: 'Press Inclinado', videoUrl: '', muscleGroup: 'Pecho', equipment: 'Barra', difficulty: 'intermedio', notes: 'Banco a 30-45°. Enfatiza la porción superior del pectoral.' },
  { name: 'Aperturas', videoUrl: '', muscleGroup: 'Pecho', equipment: 'Mancuernas', difficulty: 'principiante', notes: 'Movimiento de abraza, codos apenas flexionados.' },
  { name: 'Press con Mancuernas', videoUrl: '', muscleGroup: 'Pecho', equipment: 'Mancuernas', difficulty: 'principiante' },
  { name: 'Cruce en Polea', videoUrl: '', muscleGroup: 'Pecho', equipment: 'Polea', difficulty: 'intermedio' },
  { name: 'Fondos', videoUrl: '', muscleGroup: 'Pecho', equipment: 'Peso corporal', difficulty: 'intermedio', notes: 'Incliná el torso hacia adelante para enfatizar el pecho.' },

  // Piernas
  { name: 'Sentadilla', videoUrl: '', muscleGroup: 'Piernas', equipment: 'Barra', difficulty: 'intermedio', notes: 'Bajá hasta que el muslo quede paralelo al piso. Rodillas afuera.' },
  { name: 'Peso Muerto', videoUrl: '', muscleGroup: 'Piernas', equipment: 'Barra', difficulty: 'avanzado', notes: 'Espalda recta, empujá el piso con los talones.' },
  { name: 'Prensa', videoUrl: '', muscleGroup: 'Piernas', equipment: 'Máquina', difficulty: 'principiante' },
  { name: 'Zancadas', videoUrl: '', muscleGroup: 'Piernas', equipment: 'Mancuernas', difficulty: 'principiante', notes: 'Paso largo, rodilla de atrás casi toca el piso.' },
  { name: 'Hip Thrust', videoUrl: '', muscleGroup: 'Piernas', equipment: 'Barra', difficulty: 'principiante', notes: 'Apoyá la espalda alta en el banco, apretá glúteos arriba.' },
  { name: 'Extensión de Cuádriceps', videoUrl: '', muscleGroup: 'Piernas', equipment: 'Máquina', difficulty: 'principiante' },
  { name: 'Curl Femoral', videoUrl: '', muscleGroup: 'Piernas', equipment: 'Máquina', difficulty: 'principiante' },
  { name: 'Elevación de Gemelos', videoUrl: '', muscleGroup: 'Piernas', equipment: 'Máquina', difficulty: 'principiante' },
  { name: 'Peso Muerto Rumano', videoUrl: '', muscleGroup: 'Piernas', equipment: 'Barra', difficulty: 'avanzado', notes: 'Rodillas semiflexionadas, sentí el estiramiento del femoral.' },
  { name: 'Búlgaras', videoUrl: '', muscleGroup: 'Piernas', equipment: 'Mancuernas', difficulty: 'intermedio', notes: 'Pie de atrás apoyado en el banco, bajá recto.' },

  // Hombros
  { name: 'Press Militar', videoUrl: '', muscleGroup: 'Hombros', equipment: 'Barra', difficulty: 'intermedio', notes: 'De pie, core firme, empujá la barra sobre la cabeza.' },
  { name: 'Elevaciones Laterales', videoUrl: '', muscleGroup: 'Hombros', equipment: 'Mancuernas', difficulty: 'principiante' },
  { name: 'Pájaros', videoUrl: '', muscleGroup: 'Hombros', equipment: 'Mancuernas', difficulty: 'principiante', notes: 'Torso inclinado, elevá hacia los costados.' },
  { name: 'Press Arnold', videoUrl: '', muscleGroup: 'Hombros', equipment: 'Mancuernas', difficulty: 'intermedio' },
  { name: 'Elevaciones Frontales', videoUrl: '', muscleGroup: 'Hombros', equipment: 'Mancuernas', difficulty: 'principiante' },
  { name: 'Face Pull', videoUrl: '', muscleGroup: 'Hombros', equipment: 'Polea', difficulty: 'principiante' },

  // Espalda
  { name: 'Remo con Barra', videoUrl: '', muscleGroup: 'Espalda', equipment: 'Barra', difficulty: 'intermedio', notes: 'Torso a 45°, llevá la barra al abdomen.' },
  { name: 'Dominadas', videoUrl: '', muscleGroup: 'Espalda', equipment: 'Peso corporal', difficulty: 'avanzado', notes: 'Pecho al bar, escápulas abajo.' },
  { name: 'Jalón al Pecho', videoUrl: '', muscleGroup: 'Espalda', equipment: 'Polea', difficulty: 'principiante' },
  { name: 'Remo en Polea', videoUrl: '', muscleGroup: 'Espalda', equipment: 'Polea', difficulty: 'principiante' },
  { name: 'Remo con Mancuerna', videoUrl: '', muscleGroup: 'Espalda', equipment: 'Mancuernas', difficulty: 'principiante', notes: 'Una mano y una rodilla apoyadas en el banco.' },
  { name: 'Pullover en Polea', videoUrl: '', muscleGroup: 'Espalda', equipment: 'Polea', difficulty: 'intermedio' },

  // Brazos
  { name: 'Curl de Bíceps', videoUrl: '', muscleGroup: 'Brazos', equipment: 'Barra', difficulty: 'principiante' },
  { name: 'Curl Martillo', videoUrl: '', muscleGroup: 'Brazos', equipment: 'Mancuernas', difficulty: 'principiante', notes: 'Agarre neutro, trabaja braquial y antebrazo.' },
  { name: 'Press Francés', videoUrl: '', muscleGroup: 'Brazos', equipment: 'Barra', difficulty: 'intermedio', notes: 'Bajá la barra a la frente con codos fijos.' },
  { name: 'Extensión de Tríceps en Polea', videoUrl: '', muscleGroup: 'Brazos', equipment: 'Polea', difficulty: 'principiante' },
  { name: 'Curl en Banco Scott', videoUrl: '', muscleGroup: 'Brazos', equipment: 'Máquina', difficulty: 'intermedio' },
  { name: 'Curl de Muñeca', videoUrl: '', muscleGroup: 'Brazos', equipment: 'Barra', difficulty: 'principiante' },

  // Core
  { name: 'Plancha', videoUrl: '', muscleGroup: 'Core', equipment: 'Peso corporal', difficulty: 'principiante', notes: 'Cuerpo en línea recta, glúteos y core apretados.' },
  { name: 'Crunch', videoUrl: '', muscleGroup: 'Core', equipment: 'Peso corporal', difficulty: 'principiante' },
  { name: 'Elevación de Piernas', videoUrl: '', muscleGroup: 'Core', equipment: 'Peso corporal', difficulty: 'intermedio' },
  { name: 'Rueda Abdominal', videoUrl: '', muscleGroup: 'Core', equipment: 'Otro', difficulty: 'avanzado' },
  { name: 'Plancha Lateral', videoUrl: '', muscleGroup: 'Core', equipment: 'Peso corporal', difficulty: 'principiante' },
  { name: 'Russian Twist', videoUrl: '', muscleGroup: 'Core', equipment: 'Kettlebell', difficulty: 'intermedio' },

  // Full Body
  { name: 'Burpees', videoUrl: '', muscleGroup: 'Full Body', equipment: 'Peso corporal', difficulty: 'intermedio' },
  { name: 'Clean and Press', videoUrl: '', muscleGroup: 'Full Body', equipment: 'Barra', difficulty: 'avanzado', notes: 'Movimiento explosivo de piso a overhead.' },
  { name: 'Kettlebell Swing', videoUrl: '', muscleGroup: 'Full Body', equipment: 'Kettlebell', difficulty: 'intermedio', notes: 'Impulso de cadera, no de brazos.' },
  { name: 'Farmer Walk', videoUrl: '', muscleGroup: 'Full Body', equipment: 'Mancuernas', difficulty: 'principiante' },
];
