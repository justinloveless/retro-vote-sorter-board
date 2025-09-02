const cardImages: { [key: number]: string } = {
  1: new URL('../../../assets/Card_1pts.png', import.meta.url).href,
  2: new URL('../../../assets/Card_2pts.png', import.meta.url).href,
  3: new URL('../../../assets/Card_3pts.png', import.meta.url).href,
  5: new URL('../../../assets/Card_5pts.png', import.meta.url).href,
  8: new URL('../../../assets/Card_8pts.png', import.meta.url).href,
  13: new URL('../../../assets/Card_13pts.png', import.meta.url).href,
  21: new URL('../../../assets/Card_21pts.png', import.meta.url).href,
  "-1": new URL('../../../assets/Card_Abstained.png', import.meta.url).href,
};

export function getCardImage(points: number): string {
  return cardImages[points] || cardImages["-1"];
} 