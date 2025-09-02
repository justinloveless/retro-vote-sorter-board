import card1pt from '../../../assets/Card_1pts.png';
import card2pt from '../../../assets/Card_2pts.png';
import card3pt from '../../../assets/Card_3pts.png';
import card5pt from '../../../assets/Card_5pts.png';
import card8pt from '../../../assets/Card_8pts.png';
import card13pt from '../../../assets/Card_13pts.png';
import card21pt from '../../../assets/Card_21pts.png';
import cardAbstained from '../../../assets/Card_Abstained.png';

const cardImages: { [key: number]: string } = {
  1: card1pt,
  2: card2pt,
  3: card3pt,
  5: card5pt,
  8: card8pt,
  13: card13pt,
  21: card21pt,
  "-1": cardAbstained,
};

export function getCardImage(points: number): string {
  return cardImages[points] || cardAbstained;
} 