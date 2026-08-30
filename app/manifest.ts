import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ритм — дневник питания',
    short_name: 'Ритм',
    description: 'Питание, активность и стрик — без лишнего.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f1e8',
    theme_color: '#24352b',
    lang: 'ru',
  };
}
