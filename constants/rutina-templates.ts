export interface TemplateDefinition {
  name: string;
  gender: 'hombre' | 'mujer';
  level: 'principiante' | 'intermedio' | 'avanzado';
  days: {
    letter: string;
    name: string;
    exercises: {
      exerciseName: string;
      sets: number;
      reps: string;
    }[];
  }[];
}

export const STANDARD_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'Hombre Principiante',
    gender: 'hombre',
    level: 'principiante',
    days: [
      {
        letter: 'A',
        name: 'Full Body A',
        exercises: [
          { exerciseName: 'Sentadilla', sets: 3, reps: '10-12' },
          { exerciseName: 'Press Banca', sets: 3, reps: '10-12' },
          { exerciseName: 'Remo con Barra', sets: 3, reps: '10-12' },
          { exerciseName: 'Press Militar', sets: 2, reps: '10-12' },
          { exerciseName: 'Plancha', sets: 2, reps: '30s' },
        ],
      },
      {
        letter: 'B',
        name: 'Full Body B',
        exercises: [
          { exerciseName: 'Peso Muerto', sets: 3, reps: '8-10' },
          { exerciseName: 'Press Inclinado', sets: 3, reps: '10-12' },
          { exerciseName: 'Jalón al Pecho', sets: 3, reps: '10-12' },
          { exerciseName: 'Curl de Bíceps', sets: 2, reps: '12-15' },
          { exerciseName: 'Press Francés', sets: 2, reps: '12-15' },
        ],
      },
      {
        letter: 'C',
        name: 'Full Body C',
        exercises: [
          { exerciseName: 'Zancadas', sets: 3, reps: '10 c/l' },
          { exerciseName: 'Fondos', sets: 3, reps: '8-10' },
          { exerciseName: 'Remo en Polea', sets: 3, reps: '10-12' },
          { exerciseName: 'Elevaciones Laterales', sets: 2, reps: '12-15' },
          { exerciseName: 'Crunch', sets: 2, reps: '15-20' },
        ],
      },
    ],
  },
  {
    name: 'Hombre Intermedio',
    gender: 'hombre',
    level: 'intermedio',
    days: [
      {
        letter: 'A',
        name: 'Empuje',
        exercises: [
          { exerciseName: 'Press Banca', sets: 4, reps: '8-10' },
          { exerciseName: 'Press Inclinado', sets: 3, reps: '10-12' },
          { exerciseName: 'Press Militar', sets: 3, reps: '8-10' },
          { exerciseName: 'Elevaciones Laterales', sets: 3, reps: '12-15' },
          { exerciseName: 'Fondos', sets: 3, reps: '10-12' },
        ],
      },
      {
        letter: 'B',
        name: 'Tirón',
        exercises: [
          { exerciseName: 'Dominadas', sets: 4, reps: '6-8' },
          { exerciseName: 'Remo con Barra', sets: 4, reps: '8-10' },
          { exerciseName: 'Jalón al Pecho', sets: 3, reps: '10-12' },
          { exerciseName: 'Curl de Bíceps', sets: 3, reps: '10-12' },
          { exerciseName: 'Curl Martillo', sets: 3, reps: '10-12' },
        ],
      },
      {
        letter: 'C',
        name: 'Piernas',
        exercises: [
          { exerciseName: 'Sentadilla', sets: 4, reps: '8-10' },
          { exerciseName: 'Prensa', sets: 3, reps: '10-12' },
          { exerciseName: 'Peso Muerto', sets: 3, reps: '8-10' },
          { exerciseName: 'Zancadas', sets: 3, reps: '10 c/l' },
          { exerciseName: 'Elevación de Gemelos', sets: 3, reps: '15-20' },
        ],
      },
    ],
  },
  {
    name: 'Hombre Avanzado',
    gender: 'hombre',
    level: 'avanzado',
    days: [
      {
        letter: 'A',
        name: 'Pecho-Tríceps',
        exercises: [
          { exerciseName: 'Press Banca', sets: 5, reps: '6-8' },
          { exerciseName: 'Press Inclinado', sets: 4, reps: '8-10' },
          { exerciseName: 'Aperturas', sets: 3, reps: '10-12' },
          { exerciseName: 'Press Francés', sets: 4, reps: '10-12' },
          { exerciseName: 'Extensión de Tríceps', sets: 3, reps: '12-15' },
        ],
      },
      {
        letter: 'B',
        name: 'Espalda-Bíceps',
        exercises: [
          { exerciseName: 'Dominadas', sets: 4, reps: '6-8' },
          { exerciseName: 'Remo con Barra', sets: 4, reps: '6-8' },
          { exerciseName: 'Jalón al Pecho', sets: 4, reps: '8-10' },
          { exerciseName: 'Remo en Polea', sets: 3, reps: '10-12' },
          { exerciseName: 'Curl de Bíceps', sets: 4, reps: '8-10' },
          { exerciseName: 'Curl Martillo', sets: 3, reps: '10-12' },
        ],
      },
      {
        letter: 'C',
        name: 'Piernas',
        exercises: [
          { exerciseName: 'Sentadilla', sets: 5, reps: '6-8' },
          { exerciseName: 'Prensa', sets: 4, reps: '8-10' },
          { exerciseName: 'Peso Muerto', sets: 4, reps: '6-8' },
          { exerciseName: 'Extensión de Cuádriceps', sets: 3, reps: '12-15' },
          { exerciseName: 'Curl Femoral', sets: 3, reps: '10-12' },
          { exerciseName: 'Elevación de Gemelos', sets: 4, reps: '12-15' },
        ],
      },
      {
        letter: 'D',
        name: 'Hombros-Brazos',
        exercises: [
          { exerciseName: 'Press Militar', sets: 4, reps: '8-10' },
          { exerciseName: 'Elevaciones Laterales', sets: 4, reps: '12-15' },
          { exerciseName: 'Pájaros', sets: 3, reps: '12-15' },
          { exerciseName: 'Curl de Bíceps', sets: 3, reps: '10-12' },
          { exerciseName: 'Press Francés', sets: 3, reps: '10-12' },
        ],
      },
    ],
  },
  {
    name: 'Mujer Principiante',
    gender: 'mujer',
    level: 'principiante',
    days: [
      {
        letter: 'A',
        name: 'Tren Inferior A',
        exercises: [
          { exerciseName: 'Sentadilla', sets: 3, reps: '12-15' },
          { exerciseName: 'Hip Thrust', sets: 3, reps: '12-15' },
          { exerciseName: 'Zancadas', sets: 2, reps: '10 c/l' },
          { exerciseName: 'Elevación de Gemelos', sets: 2, reps: '15-20' },
        ],
      },
      {
        letter: 'B',
        name: 'Tren Superior',
        exercises: [
          { exerciseName: 'Press Banca', sets: 3, reps: '10-12' },
          { exerciseName: 'Jalón al Pecho', sets: 3, reps: '10-12' },
          { exerciseName: 'Press Militar', sets: 2, reps: '10-12' },
          { exerciseName: 'Curl de Bíceps', sets: 2, reps: '12-15' },
          { exerciseName: 'Plancha', sets: 2, reps: '30s' },
        ],
      },
      {
        letter: 'C',
        name: 'Tren Inferior B',
        exercises: [
          { exerciseName: 'Peso Muerto', sets: 3, reps: '10-12' },
          { exerciseName: 'Prensa', sets: 3, reps: '12-15' },
          { exerciseName: 'Hip Thrust', sets: 3, reps: '12-15' },
          { exerciseName: 'Curl Femoral', sets: 2, reps: '12-15' },
        ],
      },
    ],
  },
  {
    name: 'Mujer Intermedio',
    gender: 'mujer',
    level: 'intermedio',
    days: [
      {
        letter: 'A',
        name: 'Piernas-Glúteos',
        exercises: [
          { exerciseName: 'Sentadilla', sets: 4, reps: '10-12' },
          { exerciseName: 'Hip Thrust', sets: 4, reps: '10-12' },
          { exerciseName: 'Zancadas', sets: 3, reps: '10 c/l' },
          { exerciseName: 'Extensión de Cuádriceps', sets: 3, reps: '12-15' },
          { exerciseName: 'Curl Femoral', sets: 3, reps: '12-15' },
        ],
      },
      {
        letter: 'B',
        name: 'Tren Superior',
        exercises: [
          { exerciseName: 'Press Banca', sets: 3, reps: '10-12' },
          { exerciseName: 'Remo con Barra', sets: 3, reps: '10-12' },
          { exerciseName: 'Press Militar', sets: 3, reps: '10-12' },
          { exerciseName: 'Jalón al Pecho', sets: 3, reps: '10-12' },
          { exerciseName: 'Curl de Bíceps', sets: 3, reps: '12-15' },
        ],
      },
      {
        letter: 'C',
        name: 'Piernas-Fuerza',
        exercises: [
          { exerciseName: 'Peso Muerto', sets: 4, reps: '8-10' },
          { exerciseName: 'Prensa', sets: 4, reps: '10-12' },
          { exerciseName: 'Hip Thrust', sets: 3, reps: '10-12' },
          { exerciseName: 'Elevación de Gemelos', sets: 3, reps: '15-20' },
          { exerciseName: 'Plancha', sets: 3, reps: '45s' },
        ],
      },
    ],
  },
  {
    name: 'Mujer Avanzada',
    gender: 'mujer',
    level: 'avanzado',
    days: [
      {
        letter: 'A',
        name: 'Piernas Intenso',
        exercises: [
          { exerciseName: 'Sentadilla', sets: 5, reps: '8-10' },
          { exerciseName: 'Hip Thrust', sets: 4, reps: '10-12' },
          { exerciseName: 'Prensa', sets: 4, reps: '10-12' },
          { exerciseName: 'Extensión de Cuádriceps', sets: 3, reps: '12-15' },
        ],
      },
      {
        letter: 'B',
        name: 'Empuje',
        exercises: [
          { exerciseName: 'Press Banca', sets: 4, reps: '8-10' },
          { exerciseName: 'Press Inclinado', sets: 3, reps: '10-12' },
          { exerciseName: 'Press Militar', sets: 3, reps: '8-10' },
          { exerciseName: 'Elevaciones Laterales', sets: 3, reps: '12-15' },
          { exerciseName: 'Extensión de Tríceps', sets: 3, reps: '12-15' },
        ],
      },
      {
        letter: 'C',
        name: 'Tirón',
        exercises: [
          { exerciseName: 'Dominadas', sets: 3, reps: '6-8' },
          { exerciseName: 'Remo con Barra', sets: 4, reps: '8-10' },
          { exerciseName: 'Jalón al Pecho', sets: 3, reps: '10-12' },
          { exerciseName: 'Remo en Polea', sets: 3, reps: '10-12' },
          { exerciseName: 'Curl de Bíceps', sets: 3, reps: '10-12' },
        ],
      },
      {
        letter: 'D',
        name: 'Piernas Volumen',
        exercises: [
          { exerciseName: 'Peso Muerto', sets: 4, reps: '8-10' },
          { exerciseName: 'Zancadas', sets: 3, reps: '10 c/l' },
          { exerciseName: 'Hip Thrust', sets: 4, reps: '10-12' },
          { exerciseName: 'Curl Femoral', sets: 3, reps: '10-12' },
          { exerciseName: 'Elevación de Gemelos', sets: 4, reps: '15-20' },
        ],
      },
    ],
  },
];
