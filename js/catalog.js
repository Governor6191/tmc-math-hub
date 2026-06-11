let cached = null;

export async function loadCatalog(url = 'data/catalog.json', fetcher = u => fetch(u)) {
  if (cached) return cached;
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`Could not load the course catalog (HTTP ${res.status})`);
  cached = await res.json();
  return cached;
}

export function resetCatalogCache() { cached = null; }

export function findCourse(catalog, courseId) {
  for (const y of catalog.years) {
    for (const s of y.semesters) {
      const course = s.courses.find(c => c.id === courseId);
      if (course) return { course, year: y.year, semester: s.semester };
    }
  }
  return null;
}

export function courseStats(course) {
  const slides = course.topics.reduce((n, t) => n + t.slides.length, 0);
  const videos = course.topics.reduce((n, t) => n + t.videos.length, 0);
  return {
    topics: course.topics.length,
    slides,
    videos,
    materials: course.materials.length,
    files: slides + course.materials.length,
  };
}
