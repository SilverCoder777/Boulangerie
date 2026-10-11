export const products = [
  { id: 'croissant', name: 'Le croissant pur beurre', category: 'Viennoiseries', price: 190, image: 'croissant', tag: 'Le favori', description: 'Un feuilletage délicat, un cœur tendre et du bon beurre français.', allergens: 'Blé (gluten), lait, œufs' },
  { id: 'campagne', name: 'Le pain de campagne', category: 'Pains', price: 650, image: 'campagne', tag: 'Au levain', description: 'Une croûte généreuse et une mie vivante. Notre levain fait le reste. 500 g.', allergens: 'Blé et seigle (gluten)' },
  { id: 'chocolat', name: 'Le pain au chocolat', category: 'Viennoiseries', price: 220, image: 'chocolat', description: 'Notre pâte feuilletée maison et deux barres de chocolat noir.', allergens: 'Blé (gluten), lait, œufs, soja' },
  { id: 'tarte', name: 'La tarte aux fraises', category: 'Pâtisseries', price: 590, image: 'tarte', tag: 'De saison', description: 'Une pâte sablée, une crème vanillée et des fraises fraîches. Portion individuelle.', allergens: 'Blé (gluten), lait, œufs, amandes' },
  { id: 'baguette', name: 'La baguette tradition', category: 'Pains', price: 140, image: 'baguette', description: 'Farine française, fermentation lente et une belle croûte dorée. 250 g.', allergens: 'Blé (gluten)' },
  { id: 'brioche', name: 'La brioche du dimanche', category: 'Viennoiseries', price: 790, image: 'brioche', description: 'Moelleuse et généreuse, à partager au petit-déjeuner. 400 g.', allergens: 'Blé (gluten), lait, œufs' },
];
export const money = cents => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
