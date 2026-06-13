let cached = null;

export async function loadCatalog(url = 'data/catalog.json', fetcher = u => fetch(u)) {
  if (cached !== null) return cached;
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

export function semesterStats(semester) {
  const totals = { courses: semester.courses.length, questions: 0, files: 0, topics: 0, videos: 0 };
  for (const c of semester.courses) {
    const st = courseStats(c);
    totals.questions += st.questions;
    totals.files += st.files;
    totals.topics += st.topics;
    totals.videos += st.videos;
  }
  return totals;
}

export function yearStats(year) {
  const totals = { courses: 0, questions: 0, files: 0, topics: 0, videos: 0 };
  for (const s of year.semesters) {
    const st = semesterStats(s);
    for (const k of Object.keys(totals)) totals[k] += st[k];
  }
  return totals;
}

export function courseStats(course) {
  const slides = course.topics.reduce((n, t) => n + t.slides.length, 0);
  const videos = course.topics.reduce((n, t) => n + t.videos.length, 0);
  return {
    topics: course.topics.length,
    slides,
    videos,
    materials: course.materials.length,
    files: slides + course.materials.length, // YouTube videos excluded since they are not downloadable files
    questions: course.topics.reduce((n, t) => n + (t.questionCount ?? 0), 0),
  };
}
