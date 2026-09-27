// User-supplied campus images. Each day/night pair depicts the same location.
export const campusImages = [
  {
    key: 'campus-building',
    title: 'Campus building',
    alt: 'Campus building framed by trees and gardens',
  },
  {
    key: 'covered-walkway',
    title: 'Covered walkway',
    alt: 'Covered campus walkway beside landscaped gardens',
  },
  {
    key: 'dormitory-courtyard',
    title: 'Dormitory courtyard',
    alt: 'Dormitory buildings around a garden courtyard and statue',
  },
].map((item) => ({
  ...item,
  image: `/static/campus/${item.key}.webp`,
  darkImage: `/static/campus/${item.key}-dark.webp`,
}));

export function themedCampusImage(image, theme) {
  const stock = campusImages.find((item) => item.image === image);
  return stock && theme === 'dark' ? stock.darkImage : image;
}
