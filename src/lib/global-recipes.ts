import { getItemDietType, type ItemDietType } from "@/lib/diet";

/**
 * Built-in dishes for the 15 cuisines on the recipes page. TheMealDB is an
 * outside database we cannot add to, and it has nothing for Peru, Indonesia
 * or Serbia, so these live here.
 *
 * Each dish's diet is NOT typed in. It is read from its own ingredient list
 * with the same classifier the rest of the app uses, so a dish cannot be
 * shown to a vegetarian because its label said so. The test in
 * global-recipes.test.ts checks every country offers at least one vegetarian
 * dish, so the veg filter is never empty for a cuisine.
 */

export interface LocalRecipe {
  id: string;
  name: string;
  ingredients: string[];
  steps: string[];
}

export const LOCAL_RECIPES: Record<string, LocalRecipe[]> = {
  Italy: [
    {
      id: "italy-margherita",
      name: "Margherita Pizza",
      ingredients: ["250 g pizza dough", "100 ml passata", "125 g mozzarella", "10 fresh basil leaves", "1 tbsp olive oil", "pinch of salt"],
      steps: [
        "Heat the oven as high as it goes, at least 250°C.",
        "Roll the dough thin and spread the passata over it, leaving a border.",
        "Tear the mozzarella over the top and bake for 8 to 10 minutes until the crust is golden.",
        "Scatter the basil and drizzle with olive oil before serving.",
      ],
    },
    {
      id: "italy-carbonara",
      name: "Spaghetti Carbonara",
      ingredients: ["200 g spaghetti", "100 g pancetta or guanciale, diced", "2 large eggs", "1 egg yolk", "50 g Pecorino Romano, finely grated", "freshly ground black pepper"],
      steps: [
        "Boil the spaghetti in well salted water until just al dente.",
        "Fry the pancetta in its own fat until crisp, then take the pan off the heat.",
        "Whisk the eggs, yolk, cheese and plenty of pepper together.",
        "Drain the pasta, keeping a cup of the water. Toss the pasta with the pancetta, then the egg mix, adding a splash of pasta water until creamy. Do not scramble the eggs.",
      ],
    },
    {
      id: "italy-caprese",
      name: "Caprese Salad",
      ingredients: ["3 ripe tomatoes", "250 g fresh mozzarella", "1 small bunch fresh basil", "2 tbsp olive oil", "1 tsp balsamic vinegar", "salt and black pepper"],
      steps: [
        "Slice the tomatoes and mozzarella into rounds of similar thickness.",
        "Arrange them on a plate, overlapping, with a basil leaf between each slice.",
        "Season, drizzle with oil and balsamic, and serve at room temperature.",
      ],
    },
    {
      id: "italy-minestrone",
      name: "Minestrone",
      ingredients: ["1 onion", "2 carrots", "2 celery sticks", "2 garlic cloves", "2 courgettes", "400 g tin chopped tomatoes", "400 g tin borlotti beans", "100 g small pasta", "1 litre vegetable stock", "2 tbsp olive oil", "a handful of spinach"],
      steps: [
        "Soften the onion, carrot and celery in the oil for 8 minutes.",
        "Add the garlic, courgettes, tomatoes and stock, and simmer for 15 minutes.",
        "Add the beans and pasta and cook until the pasta is tender.",
        "Stir in the spinach until wilted and season to taste.",
      ],
    },
    {
      id: "italy-frittata",
      name: "Courgette Frittata",
      ingredients: ["6 large eggs", "2 courgettes, thinly sliced", "1 onion, finely sliced", "50 g Parmesan, grated", "2 tbsp olive oil", "salt and black pepper"],
      steps: [
        "Fry the courgette and onion in the oil over a medium heat until soft.",
        "Beat the eggs with the Parmesan and seasoning, then pour over the vegetables.",
        "Cook gently with a lid on until the edges set and the middle is just firm.",
        "Finish under a hot grill for a minute to set the top.",
      ],
    },
  ],
  Greece: [
    {
      id: "greece-salad",
      name: "Greek Salad",
      ingredients: ["3 tomatoes, cut into chunks", "1 cucumber, sliced", "1 red onion, sliced", "1 green pepper, sliced", "150 g feta", "12 kalamata olives", "3 tbsp olive oil", "1 tsp dried oregano"],
      steps: [
        "Combine the tomatoes, cucumber, onion and pepper in a bowl.",
        "Add the olives and top with a whole block of feta.",
        "Drizzle with the oil and sprinkle with oregano.",
      ],
    },
    {
      id: "greece-spanakopita",
      name: "Spanakopita",
      ingredients: ["500 g spinach", "1 onion, finely chopped", "200 g feta, crumbled", "2 eggs, beaten", "6 sheets filo pastry", "50 g butter, melted", "a handful of dill, chopped"],
      steps: [
        "Wilt the spinach, squeeze out the water, and chop it finely.",
        "Soften the onion, then mix with the spinach, feta, eggs and dill.",
        "Layer the filo in a buttered tin, brushing each sheet with butter. Spread the filling over and cover with more filo.",
        "Score the top and bake at 180°C for 35 to 40 minutes until golden.",
      ],
    },
    {
      id: "greece-tzatziki",
      name: "Tzatziki",
      ingredients: ["500 g Greek yoghurt", "1 cucumber, grated and squeezed dry", "2 garlic cloves, crushed", "1 tbsp chopped dill", "1 tsp lemon juice", "1 tbsp olive oil", "salt"],
      steps: [
        "Mix the grated cucumber, garlic and dill into the yoghurt.",
        "Season with lemon juice and salt.",
        "Chill for at least 30 minutes and finish with a drizzle of oil.",
      ],
    },
    {
      id: "greece-lemon-potatoes",
      name: "Lemon Roast Potatoes",
      ingredients: ["1 kg potatoes, cut into wedges", "juice of 2 lemons", "4 tbsp olive oil", "2 garlic cloves, sliced", "1 tsp dried oregano", "200 ml water", "salt"],
      steps: [
        "Toss the potatoes with the oil, lemon juice, garlic, oregano and salt in a roasting tin.",
        "Pour the water around them.",
        "Roast at 200°C for about 45 minutes, turning once, until golden and tender.",
      ],
    },
    {
      id: "greece-fasolada",
      name: "Fasolada",
      ingredients: ["300 g dried white beans, soaked overnight", "1 onion, chopped", "2 carrots, chopped", "2 celery sticks, chopped", "3 tomatoes, grated", "3 tbsp olive oil", "1.5 litres water", "salt and black pepper"],
      steps: [
        "Simmer the drained beans in the water for about an hour.",
        "Fry the onion, carrot and celery in some of the oil, then add the tomatoes and cook for 5 minutes.",
        "Add the vegetables to the beans and simmer until the soup is thick and creamy.",
        "Season, then stir in the remaining oil before serving.",
      ],
    },
  ],
  Peru: [
    {
      id: "peru-ceviche",
      name: "Ceviche",
      ingredients: ["500 g fresh white fish fillet, diced", "juice of 8 limes", "1 red onion, thinly sliced", "1 aji amarillo or red chilli, minced", "a small bunch of coriander, chopped", "salt", "1 sweet potato, boiled and sliced", "1 cob of corn, kernels cut off and cooked"],
      steps: [
        "Dice the fish and cover it with lime juice, then add salt.",
        "Stir in the onion and chilli and leave for about 10 minutes until the fish turns opaque.",
        "Serve straight away with coriander, sweet potato and corn.",
      ],
    },
    {
      id: "peru-lomo-saltado",
      name: "Lomo Saltado",
      ingredients: ["400 g beef sirloin, cut into strips", "1 red onion, sliced", "2 tomatoes, cut into wedges", "1 aji amarillo, sliced", "2 garlic cloves, minced", "2 tbsp soy sauce", "1 tbsp red wine vinegar", "2 tbsp vegetable oil", "300 g potatoes, cut into chips and fried", "cooked white rice", "coriander"],
      steps: [
        "Stir-fry the beef in very hot oil until browned, then remove.",
        "Fry the onion, chilli and garlic for 2 minutes, then add the tomato.",
        "Return the beef, add the soy and vinegar, and toss with the fried potatoes.",
        "Serve with rice and coriander.",
      ],
    },
    {
      id: "peru-huancaina",
      name: "Papa a la Huancaína",
      ingredients: ["6 yellow potatoes, boiled", "2 aji amarillo or 1 tsp chilli paste", "150 g queso fresco or feta", "100 ml evaporated milk", "4 soda crackers", "2 tbsp vegetable oil", "1 garlic clove", "2 hard-boiled eggs, halved", "lettuce leaves", "black olives"],
      steps: [
        "Blend the chilli, cheese, milk, crackers, oil and garlic until smooth.",
        "Slice the potatoes and arrange them on lettuce.",
        "Pour the sauce over and garnish with the eggs and olives.",
      ],
    },
    {
      id: "peru-aji-de-gallina",
      name: "Aji de Gallina",
      ingredients: ["500 g chicken thighs, boiled and shredded", "2 slices white bread, soaked in milk", "2 aji amarillo or 1 tsp chilli paste", "1 onion, chopped", "2 garlic cloves", "50 g walnuts", "50 g Parmesan, grated", "250 ml evaporated milk", "2 tbsp vegetable oil", "cooked white rice"],
      steps: [
        "Blend the chilli, onion, garlic, walnuts and soaked bread into a paste.",
        "Fry the paste in the oil for 5 minutes until it thickens.",
        "Stir in the Parmesan and milk, then the shredded chicken.",
        "Serve over rice.",
      ],
    },
    {
      id: "peru-quinoa-salad",
      name: "Quinoa Salad with Avocado",
      ingredients: ["200 g quinoa", "1 ripe avocado, diced", "1 cucumber, diced", "2 tomatoes, diced", "juice of 2 limes", "3 tbsp olive oil", "a small bunch of coriander, chopped", "salt"],
      steps: [
        "Rinse and cook the quinoa in twice its volume of water until the grains open, then cool.",
        "Toss with the vegetables, lime juice, oil and coriander.",
        "Season and add the avocado just before serving.",
      ],
    },
  ],
  Portugal: [
    {
      id: "portugal-bacalhau",
      name: "Bacalhau à Brás",
      ingredients: ["300 g salt cod, soaked overnight", "3 medium potatoes, thinly sliced", "1 onion, sliced", "2 garlic cloves, sliced", "4 eggs, beaten", "a small bunch of parsley", "black olives", "4 tbsp olive oil"],
      steps: [
        "Poach the soaked cod until it flakes, then flake it.",
        "Fry the potatoes in the oil until crisp, then remove.",
        "Soften the onion and garlic in the same oil, then add the cod and potatoes.",
        "Stir in the eggs over low heat until just set. Garnish with parsley and olives.",
      ],
    },
    {
      id: "portugal-caldo-verde",
      name: "Caldo Verde (Vegetarian)",
      ingredients: ["500 g potatoes, peeled", "1 onion, chopped", "2 garlic cloves", "200 g kale or cabbage greens, finely shredded", "1.5 litres vegetable stock", "3 tbsp olive oil", "salt and black pepper"],
      steps: [
        "Simmer the potatoes, onion and garlic in the stock until very soft.",
        "Mash lightly in the pan.",
        "Add the shredded greens and simmer for 5 minutes.",
        "Season and finish with a swirl of olive oil.",
      ],
    },
    {
      id: "portugal-pastel-de-nata",
      name: "Pastéis de Nata",
      ingredients: ["500 g puff pastry", "250 ml whole milk", "1 cinnamon stick", "1 strip of lemon peel", "75 g caster sugar", "3 tbsp plain flour", "3 egg yolks", "1 tsp vanilla extract", "icing sugar, to dust"],
      steps: [
        "Heat the milk gently with the cinnamon and lemon peel, then leave to infuse.",
        "Mix the sugar, flour and yolks, then strain in the milk and cook, stirring, until thick. Cool.",
        "Roll the pastry, cut into rounds and press into a muffin tin.",
        "Fill with custard and bake at 220°C for 15 to 20 minutes until blistered. Dust with icing sugar.",
      ],
    },
    {
      id: "portugal-piri-piri",
      name: "Piri-Piri Chicken",
      ingredients: ["1 kg chicken thighs", "3 red chillies", "4 garlic cloves", "juice of 1 lemon", "3 tbsp olive oil", "1 tsp paprika", "1 tsp salt"],
      steps: [
        "Blend the chillies, garlic, lemon juice, oil, paprika and salt into a marinade.",
        "Coat the chicken and leave for at least 2 hours.",
        "Roast at 200°C for 35 to 40 minutes until cooked through.",
      ],
    },
    {
      id: "portugal-acorda",
      name: "Açorda",
      ingredients: ["250 g stale bread, torn", "4 garlic cloves", "a small bunch of coriander, chopped", "4 tbsp olive oil", "2 eggs, beaten", "750 ml water", "salt"],
      steps: [
        "Simmer the garlic and salt in the water for 5 minutes.",
        "Divide the bread between bowls and pour the hot garlic water over.",
        "Stir in the beaten eggs and the oil, and top with coriander.",
      ],
    },
  ],
  Spain: [
    {
      id: "spain-paella",
      name: "Chicken and Vegetable Paella",
      ingredients: ["300 g paella rice", "500 g chicken thighs, chopped", "1 red pepper, sliced", "100 g green beans", "2 garlic cloves, minced", "1 tomato, grated", "1 tsp smoked paprika", "a pinch of saffron", "1 litre chicken stock", "3 tbsp olive oil", "lemon wedges"],
      steps: [
        "Brown the chicken in the oil in a wide pan, then remove.",
        "Fry the pepper, beans, garlic and tomato, then add the paprika and rice and stir for a minute.",
        "Pour in the hot stock with the saffron, return the chicken, and simmer uncovered for about 18 minutes without stirring.",
        "Rest for 5 minutes and serve with lemon.",
      ],
    },
    {
      id: "spain-gazpacho",
      name: "Gazpacho",
      ingredients: ["1 kg ripe tomatoes", "1 cucumber", "1 red pepper", "1 garlic clove", "1 slice stale bread", "3 tbsp olive oil", "1 tbsp sherry vinegar", "salt"],
      steps: [
        "Roughly chop the tomatoes, cucumber and pepper, then blend with the garlic, bread, oil and vinegar.",
        "Blend until smooth, then pass through a sieve and season.",
        "Chill for at least 2 hours before serving.",
      ],
    },
    {
      id: "spain-tortilla",
      name: "Tortilla Española",
      ingredients: ["5 potatoes, thinly sliced", "1 onion, thinly sliced", "6 eggs", "150 ml olive oil", "salt"],
      steps: [
        "Cook the potatoes and onion gently in the oil until soft, not browned. Drain.",
        "Beat the eggs with salt, then mix in the potatoes and onion.",
        "Cook in a little oil over a medium heat, shaking the pan, until set underneath.",
        "Slide onto a plate, flip back into the pan and cook the other side.",
      ],
    },
    {
      id: "spain-bravas",
      name: "Patatas Bravas",
      ingredients: ["1 kg potatoes, cut into chunks", "3 tbsp olive oil", "1 tbsp smoked paprika", "1 tsp cayenne", "200 g tomato passata", "1 garlic clove, minced", "1 tbsp white wine vinegar", "1 tsp salt"],
      steps: [
        "Fry or roast the potatoes until golden and crisp.",
        "For the sauce, fry the garlic, then add the passata, paprika, cayenne and vinegar and simmer for 5 minutes.",
        "Season and spoon the sauce over the potatoes.",
      ],
    },
    {
      id: "spain-espinacas",
      name: "Spinach with Chickpeas",
      ingredients: ["500 g spinach", "400 g tin chickpeas, drained", "2 garlic cloves", "1 slice bread, fried", "1 tsp cumin", "1 tsp smoked paprika", "3 tbsp olive oil", "1 tbsp sherry vinegar", "salt"],
      steps: [
        "Fry the garlic and bread in the oil, then blend with the cumin, paprika and vinegar.",
        "Wilt the spinach in a pan, then add the chickpeas.",
        "Stir in the blended paste and simmer for 5 minutes.",
      ],
    },
  ],
  Japan: [
    {
      id: "japan-tempura",
      name: "Vegetable Tempura",
      ingredients: ["1 courgette, sliced", "1 sweet potato, sliced into rounds", "100 g green beans", "100 g plain flour", "1 egg", "150 ml ice-cold water", "pinch of salt", "oil for frying"],
      steps: [
        "Whisk the egg into the ice-cold water, then stir in the flour and salt. Leave lumpy.",
        "Dip the vegetables in the batter.",
        "Fry in oil at 180°C until crisp and pale golden. Drain on kitchen paper.",
      ],
    },
    {
      id: "japan-miso",
      name: "Miso Soup (with Bonito Dashi)",
      ingredients: ["1 litre water", "10 g dried kombu", "10 g bonito flakes (katsuobushi)", "3 tbsp miso paste", "100 g tofu, cubed", "2 tbsp dried wakame", "2 spring onions, sliced"],
      steps: [
        "Soak the kombu in the cold water for 30 minutes, then warm gently and remove just before it boils.",
        "Add the bonito flakes, leave for a minute, then strain to make the dashi.",
        "Off the heat, whisk the miso into the dashi, then add the tofu, wakame and spring onion.",
      ],
    },
    {
      id: "japan-katsu",
      name: "Chicken Katsu",
      ingredients: ["2 chicken breasts", "50 g plain flour", "1 egg, beaten", "100 g panko breadcrumbs", "oil for frying", "tonkatsu sauce", "shredded cabbage"],
      steps: [
        "Flatten the chicken to an even thickness and season.",
        "Coat in flour, then egg, then panko, pressing the crumbs on.",
        "Fry at 170°C for 5 to 6 minutes, turning once, until cooked through.",
        "Slice and serve with cabbage and tonkatsu sauce.",
      ],
    },
    {
      id: "japan-oyakodon",
      name: "Oyakodon",
      ingredients: ["2 chicken thighs, sliced", "2 eggs, beaten", "1 onion, sliced", "150 ml dashi made with bonito flakes", "2 tbsp soy sauce", "1 tbsp mirin", "1 tsp sugar", "2 bowls cooked rice"],
      steps: [
        "Simmer the onion in the dashi, soy, mirin and sugar for 3 minutes.",
        "Add the chicken and cook for 5 minutes.",
        "Pour the eggs over, cover, and cook until just set.",
        "Spoon over rice.",
      ],
    },
    {
      id: "japan-yasai-itame",
      name: "Yasai Itame (Vegetable Stir-Fry)",
      ingredients: ["1 carrot, thinly sliced", "1 courgette, sliced", "100 g cabbage, shredded", "100 g mushrooms, sliced", "2 garlic cloves, sliced", "1 tbsp vegetable oil", "2 tbsp soy sauce", "1 tsp sesame oil"],
      steps: [
        "Stir-fry the garlic in the hot oil for 30 seconds.",
        "Add the carrot and mushrooms and stir-fry for 2 minutes.",
        "Add the courgette and cabbage and cook until just tender.",
        "Season with soy and sesame oil.",
      ],
    },
  ],
  Turkey: [
    {
      id: "turkey-mercimek",
      name: "Red Lentil Soup",
      ingredients: ["200 g red lentils, rinsed", "1 onion, chopped", "1 carrot, chopped", "1 tbsp tomato paste", "1 tbsp butter", "1 tsp cumin", "1 litre vegetable stock", "lemon wedges", "chilli flakes"],
      steps: [
        "Fry the onion and carrot in the butter, then stir in the tomato paste and cumin.",
        "Add the lentils and stock and simmer for 20 minutes.",
        "Blend until smooth and serve with lemon and chilli flakes.",
      ],
    },
    {
      id: "turkey-menemen",
      name: "Menemen",
      ingredients: ["3 tomatoes, grated", "1 green pepper, chopped", "1 onion, chopped", "3 eggs", "2 tbsp olive oil", "1 tsp chilli flakes", "salt"],
      steps: [
        "Soften the pepper and onion in the oil, then add the tomatoes and cook until thick.",
        "Stir in the chilli flakes and salt.",
        "Beat the eggs in, stirring gently until just set.",
      ],
    },
    {
      id: "turkey-imam-bayildi",
      name: "Imam Bayildi",
      ingredients: ["2 aubergines", "1 onion, sliced", "2 garlic cloves, sliced", "2 tomatoes, chopped", "1 green pepper, chopped", "100 ml olive oil", "1 tsp sugar", "a small bunch of parsley", "lemon wedges"],
      steps: [
        "Halve the aubergines lengthways and fry until soft.",
        "Soften the onion, garlic, tomato and pepper, and stir in the parsley.",
        "Fill the aubergines with the mixture and simmer in the oil, sugar and a little water for 30 minutes.",
        "Serve cool with lemon.",
      ],
    },
    {
      id: "turkey-cacik",
      name: "Cacık",
      ingredients: ["400 g Greek yoghurt", "1 cucumber, grated and squeezed dry", "2 garlic cloves, crushed", "1 tbsp dried mint", "1 tbsp olive oil", "salt"],
      steps: [
        "Mix the cucumber and garlic into the yoghurt.",
        "Season with salt, sprinkle with mint and drizzle with oil.",
      ],
    },
    {
      id: "turkey-pilav",
      name: "Turkish Rice Pilav",
      ingredients: ["300 g long-grain rice, rinsed", "1 tbsp butter", "600 ml vegetable stock", "1 tsp salt"],
      steps: [
        "Melt the butter and toast the rice in it for 2 minutes.",
        "Pour in the hot stock and salt, cover, and simmer on low for 15 minutes.",
        "Rest off the heat for 10 minutes before fluffing.",
      ],
    },
  ],
  China: [
    {
      id: "china-egg-fried-rice",
      name: "Egg Fried Rice",
      ingredients: ["300 g cooked cold rice", "3 eggs, beaten", "2 spring onions, sliced", "100 g frozen peas", "2 tbsp soy sauce", "1 tbsp vegetable oil", "1 garlic clove, minced"],
      steps: [
        "Scramble the eggs in hot oil, then remove.",
        "Fry the garlic, peas and rice on high heat for 3 minutes, breaking up the clumps.",
        "Return the egg, add the soy and spring onion, and toss to combine.",
      ],
    },
    {
      id: "china-kung-pao",
      name: "Kung Pao Chicken",
      ingredients: ["300 g chicken thigh, cubed", "1 tbsp soy sauce", "1 tbsp cornflour", "2 tbsp vegetable oil", "10 dried red chillies", "1 tbsp Sichuan peppercorns", "2 garlic cloves, minced", "2 spring onions, sliced", "50 g roasted peanuts", "1 tbsp rice vinegar", "1 tsp sugar"],
      steps: [
        "Toss the chicken in the soy and cornflour.",
        "Fry the chillies and peppercorns in the oil for 30 seconds, then add the chicken and cook until done.",
        "Add the garlic and spring onion, then the vinegar and sugar, and toss.",
        "Finish with the peanuts.",
      ],
    },
    {
      id: "china-bok-choy",
      name: "Garlic Bok Choy",
      ingredients: ["400 g bok choy, halved", "3 garlic cloves, sliced", "1 tbsp vegetable oil", "1 tbsp soy sauce", "1 tsp sesame oil", "1 tsp sugar"],
      steps: [
        "Fry the garlic in the hot oil until fragrant.",
        "Add the bok choy and stir-fry for 2 to 3 minutes until just wilted.",
        "Season with soy, sugar and sesame oil.",
      ],
    },
    {
      id: "china-mapo-tofu",
      name: "Mapo Tofu",
      ingredients: ["400 g soft tofu, cubed", "150 g minced pork", "2 tbsp chilli bean paste", "2 garlic cloves, minced", "200 ml water", "1 tbsp soy sauce", "2 spring onions, sliced", "1 tsp ground Sichuan peppercorns", "1 tbsp cornflour mixed with 2 tbsp water"],
      steps: [
        "Fry the pork until crisp and the fat has rendered.",
        "Add the chilli bean paste and garlic, then the water and soy.",
        "Slide in the tofu gently and simmer for 3 minutes.",
        "Thicken with the cornflour mix and finish with spring onion and peppercorns.",
      ],
    },
    {
      id: "china-spring-rolls",
      name: "Vegetable Spring Rolls",
      ingredients: ["8 spring roll wrappers", "100 g cabbage, shredded", "1 carrot, cut into matchsticks", "50 g bean sprouts", "2 spring onions, sliced", "1 tbsp soy sauce", "1 tbsp vegetable oil", "1 tbsp cornflour mixed with 2 tbsp water", "oil for deep frying"],
      steps: [
        "Stir-fry the vegetables briefly with the soy, then drain well and cool.",
        "Place a spoonful on each wrapper, roll tightly and seal with the cornflour paste.",
        "Deep-fry at 180°C until golden and crisp.",
      ],
    },
  ],
  France: [
    {
      id: "france-ratatouille",
      name: "Ratatouille",
      ingredients: ["2 aubergines, cubed", "2 courgettes, sliced", "1 red pepper, sliced", "1 onion, sliced", "3 tomatoes, chopped", "2 garlic cloves, minced", "3 tbsp olive oil", "1 tsp dried thyme", "salt and black pepper"],
      steps: [
        "Fry the aubergine, courgette and pepper separately in the oil until golden, then set aside.",
        "Soften the onion and garlic, then add the tomatoes and thyme.",
        "Return the vegetables and simmer gently for 30 minutes until jammy.",
      ],
    },
    {
      id: "france-croque-monsieur",
      name: "Croque Monsieur",
      ingredients: ["4 slices white bread", "100 g cooked ham", "120 g Gruyère, grated", "2 tbsp butter", "1 tbsp plain flour", "200 ml milk", "pinch of nutmeg"],
      steps: [
        "Make a white sauce: melt the butter, stir in the flour, then add the milk gradually and simmer until thick. Season with nutmeg.",
        "Assemble two sandwiches with the ham and half the cheese.",
        "Spoon the sauce over the tops, sprinkle with the rest of the cheese, and grill until golden and bubbling.",
      ],
    },
    {
      id: "france-quiche-lorraine",
      name: "Quiche Lorraine",
      ingredients: ["200 g shortcrust pastry", "150 g bacon lardons", "3 eggs", "200 ml double cream", "100 g Gruyère, grated", "pinch of nutmeg"],
      steps: [
        "Line a 20 cm tin with the pastry and bake blind at 180°C for 15 minutes.",
        "Fry the lardons until crisp.",
        "Whisk the eggs, cream and nutmeg, then scatter the lardons and cheese into the case and pour the custard over.",
        "Bake for 30 minutes until set.",
      ],
    },
    {
      id: "france-gratin-dauphinois",
      name: "Gratin Dauphinois",
      ingredients: ["1 kg potatoes, sliced thinly", "400 ml double cream", "200 ml whole milk", "2 garlic cloves, halved", "100 g Gruyère, grated", "butter for the dish", "pinch of nutmeg", "salt"],
      steps: [
        "Rub a baking dish with the garlic and butter.",
        "Layer the potatoes with the cream and milk, nutmeg and salt.",
        "Top with the cheese and bake at 180°C for about an hour until tender and golden.",
      ],
    },
    {
      id: "france-onion-soup",
      name: "Onion Soup Gratinée (Vegetarian)",
      ingredients: ["4 onions, thinly sliced", "2 tbsp butter", "1 tbsp olive oil", "1 tsp sugar", "1 litre vegetable stock", "100 g Gruyère, grated", "4 slices baguette"],
      steps: [
        "Cook the onions slowly in the butter and oil for about 40 minutes until deep golden.",
        "Add the sugar and stock and simmer for 20 minutes.",
        "Ladle into bowls, top with toasted baguette and cheese, and grill until bubbling.",
      ],
    },
  ],
  Indonesia: [
    {
      id: "indonesia-nasi-goreng",
      name: "Nasi Goreng",
      ingredients: ["300 g cooked cold rice", "2 eggs", "1 onion, minced", "2 garlic cloves, minced", "1 red chilli, minced", "2 tbsp kecap manis", "1 tbsp vegetable oil", "100 g green beans, chopped", "1 tomato, diced"],
      steps: [
        "Fry the onion, garlic and chilli in the oil until soft.",
        "Add the beans and tomato, then the rice, and stir-fry for 3 minutes.",
        "Add the kecap manis and toss until the rice is coated.",
        "Fry the eggs and serve on top.",
      ],
    },
    {
      id: "indonesia-tempeh-orek",
      name: "Tempeh Orek",
      ingredients: ["200 g tempeh, sliced", "2 shallots, minced", "2 garlic cloves, minced", "2 red chillies, sliced", "2 tbsp kecap manis", "1 tbsp tamarind paste", "1 tbsp vegetable oil", "1 bay leaf"],
      steps: [
        "Fry the tempeh until golden and set aside.",
        "Fry the shallots, garlic, chilli and bay leaf in the oil until fragrant.",
        "Add the tamarind and kecap manis, then the tempeh, and toss until sticky.",
      ],
    },
    {
      id: "indonesia-gado-gado",
      name: "Gado-Gado",
      ingredients: ["2 potatoes, boiled", "100 g green beans, blanched", "1 cucumber, sliced", "2 eggs, boiled", "100 g bean sprouts, blanched", "100 g firm tofu, fried", "100 g roasted peanuts", "1 garlic clove", "1 red chilli", "1 tbsp kecap manis", "juice of 1 lime", "100 ml water"],
      steps: [
        "Blend the peanuts, garlic, chilli, kecap manis, lime and water into a sauce.",
        "Arrange the potatoes, beans, sprouts, cucumber, tofu and egg on a plate.",
        "Pour the peanut sauce over.",
      ],
    },
    {
      id: "indonesia-sayur-lodeh",
      name: "Sayur Lodeh",
      ingredients: ["1 carrot, sliced", "100 g green beans, cut into lengths", "1 courgette, sliced", "200 ml coconut milk", "2 shallots", "2 garlic cloves", "2 red chillies", "1 tsp ground turmeric", "1 tsp ground coriander", "1 lemongrass stalk, bruised", "1 bay leaf", "500 ml water", "1 tbsp dark soy sauce"],
      steps: [
        "Blend the shallots, garlic, chilli, turmeric and coriander into a paste.",
        "Fry the paste, then add the water, lemongrass, bay leaf and soy.",
        "Add the vegetables and simmer for 10 minutes until tender.",
        "Stir in the coconut milk and heat through without boiling.",
      ],
    },
    {
      id: "indonesia-sate-ayam",
      name: "Chicken Satay",
      ingredients: ["500 g chicken thigh, cubed", "2 tbsp kecap manis", "2 garlic cloves, minced", "1 tsp ground coriander", "1 tsp ground turmeric", "1 tbsp vegetable oil", "100 g roasted peanuts", "1 garlic clove", "1 tbsp kecap manis", "100 ml water"],
      steps: [
        "Marinate the chicken in the kecap manis, garlic, coriander, turmeric and oil for at least 30 minutes.",
        "Thread onto skewers and grill for about 10 minutes, turning, until cooked through.",
        "Blend the peanuts, garlic, kecap manis and water into a sauce to serve with it.",
      ],
    },
  ],
  Mexico: [
    {
      id: "mexico-guacamole",
      name: "Guacamole",
      ingredients: ["2 ripe avocados", "half a red onion, finely chopped", "1 tomato, diced", "a small bunch of coriander, chopped", "juice of 1 lime", "1 jalapeño, minced", "salt"],
      steps: [
        "Mash the avocados roughly with a fork.",
        "Stir in the onion, tomato, coriander, jalapeño and lime juice.",
        "Season with salt and serve straight away.",
      ],
    },
    {
      id: "mexico-frijoles",
      name: "Frijoles de la Olla",
      ingredients: ["250 g dried pinto beans, soaked overnight", "1 onion, halved", "2 garlic cloves", "1 tsp ground cumin", "1 litre water", "salt"],
      steps: [
        "Drain the beans and cover with the water in a pot.",
        "Add the onion, garlic and cumin and simmer for 1.5 to 2 hours until soft.",
        "Season with salt at the end.",
      ],
    },
    {
      id: "mexico-tinga",
      name: "Chicken Tinga Tacos",
      ingredients: ["500 g chicken thigh", "2 chipotle chillies in adobo", "400 g tin chopped tomatoes", "1 onion, sliced", "2 garlic cloves", "1 tsp ground cumin", "1 tbsp vegetable oil", "8 corn tortillas"],
      steps: [
        "Poach the chicken until cooked, then shred it.",
        "Blend the tomatoes, chipotle, garlic and half the onion into a sauce.",
        "Fry the rest of the onion in the oil, add the sauce and cumin, and simmer for 10 minutes.",
        "Add the chicken and warm through. Serve in warm tortillas.",
      ],
    },
    {
      id: "mexico-rellenos",
      name: "Chiles Rellenos",
      ingredients: ["4 poblano peppers", "150 g Oaxaca or mozzarella cheese", "3 eggs, separated", "100 g plain flour", "oil for frying", "400 g tin chopped tomatoes", "1 garlic clove"],
      steps: [
        "Roast the peppers until blistered, peel, and make a slit to remove the seeds.",
        "Stuff each with cheese and dust with flour.",
        "Whisk the egg whites until stiff, fold in the yolks, then coat the peppers and fry until golden.",
        "Simmer the tomatoes with the garlic and serve the peppers in the sauce.",
      ],
    },
    {
      id: "mexico-quesadillas",
      name: "Vegetable Quesadillas",
      ingredients: ["4 flour tortillas", "150 g cheese, grated", "1 red pepper, sliced", "1 onion, sliced", "1 tsp ground cumin", "1 tbsp vegetable oil"],
      steps: [
        "Soften the pepper and onion in the oil with the cumin.",
        "Fill half of each tortilla with cheese and the vegetables, then fold over.",
        "Fry in a dry pan until golden on both sides and the cheese has melted.",
      ],
    },
  ],
  Serbia: [
    {
      id: "serbia-cevapi",
      name: "Ćevapi",
      ingredients: ["500 g minced beef and pork mix", "1 tsp salt", "1 tsp baking soda", "2 garlic cloves, minced", "1 tsp black pepper", "1 tsp paprika", "1 onion, finely chopped, to serve", "flatbread, to serve"],
      steps: [
        "Mix the meat with the spices and baking soda, then knead well.",
        "Shape into small finger-sized sausages and rest for an hour in the fridge.",
        "Grill until browned and cooked through.",
        "Serve in flatbread with raw onion.",
      ],
    },
    {
      id: "serbia-pljeskavica",
      name: "Pljeskavica",
      ingredients: ["500 g minced beef", "1 onion, grated", "1 garlic clove, minced", "1 tsp salt", "1 tsp black pepper", "1 tsp paprika", "kajmak or cheese, to serve"],
      steps: [
        "Knead the meat with the onion, garlic and spices.",
        "Shape into flat patties about 1.5 cm thick.",
        "Grill or pan-fry for 4 to 5 minutes each side. Serve with kajmak or cheese.",
      ],
    },
    {
      id: "serbia-sarma",
      name: "Sarma",
      ingredients: ["12 pickled cabbage leaves", "300 g minced pork", "100 g rice", "1 onion, chopped", "1 tbsp paprika", "1 tbsp dried dill", "2 tbsp vegetable oil", "200 ml tomato passata"],
      steps: [
        "Mix the pork, rice, onion, paprika, dill and oil.",
        "Wrap spoonfuls of the mixture in the cabbage leaves, folding the ends in.",
        "Layer the rolls in a pot, pour the passata over and add water to cover.",
        "Simmer for about 90 minutes until the rice is cooked.",
      ],
    },
    {
      id: "serbia-ajvar",
      name: "Ajvar",
      ingredients: ["4 red peppers", "1 aubergine", "2 garlic cloves", "2 tbsp sunflower oil", "1 tsp salt", "1 tbsp white vinegar"],
      steps: [
        "Roast the peppers and aubergine until charred, then peel and chop.",
        "Simmer with the garlic, oil and salt for 30 minutes.",
        "Blend coarsely and stir in the vinegar. Store in a sealed jar in the fridge.",
      ],
    },
    {
      id: "serbia-krompir-paprikas",
      name: "Potato Paprikaš (Vegetarian)",
      ingredients: ["1 kg potatoes, cubed", "1 onion, chopped", "2 tbsp vegetable oil", "2 tbsp paprika", "1 tbsp plain flour", "1 green pepper, sliced", "1 litre water", "1 tsp salt"],
      steps: [
        "Fry the onion in the oil until soft, then stir in the paprika and flour.",
        "Add the water, potatoes, pepper and salt.",
        "Simmer until the potatoes are soft and the stew is thick.",
      ],
    },
  ],
  India: [
    {
      id: "india-dal-tadka",
      name: "Dal Tadka",
      ingredients: ["200 g toor dal, rinsed", "1 onion, chopped", "2 tomatoes, chopped", "1 tsp ground turmeric", "1 tsp cumin seeds", "3 garlic cloves, sliced", "1 green chilli, slit", "1 tbsp ghee", "coriander, to garnish"],
      steps: [
        "Pressure-cook the dal with the turmeric and plenty of water until soft.",
        "Fry the cumin, garlic, chilli and onion in the ghee until golden, then add the tomatoes.",
        "Pour the tadka into the dal, simmer for 5 minutes, and garnish with coriander.",
      ],
    },
    {
      id: "india-palak-paneer",
      name: "Palak Paneer",
      ingredients: ["500 g spinach", "200 g paneer, cubed", "1 onion, chopped", "2 garlic cloves", "1 tomato, chopped", "1 tsp garam masala", "1 tsp cumin seeds", "2 tbsp cream", "1 tbsp oil"],
      steps: [
        "Blanch the spinach for 1 minute, then blend to a purée.",
        "Lightly fry the paneer and set aside.",
        "Fry the cumin, onion and garlic, add the tomato, then the spinach purée and garam masala. Simmer for 5 minutes.",
        "Add the paneer and cream and heat through.",
      ],
    },
    {
      id: "india-chana-masala",
      name: "Chana Masala",
      ingredients: ["250 g dried chickpeas, soaked overnight (or 2 tins)", "2 onions, chopped", "3 tomatoes, chopped", "2 garlic cloves", "1 tsp cumin seeds", "1 tsp ground coriander", "1 tsp garam masala", "1 tsp amchur (dried mango powder)", "1 tbsp oil"],
      steps: [
        "Simmer the chickpeas until soft.",
        "Fry the cumin, onion and garlic in the oil until golden, then add the tomatoes and spices.",
        "Add the chickpeas and their liquid, simmer 15 minutes, and finish with amchur.",
      ],
    },
    {
      id: "india-egg-bhurji",
      name: "Egg Bhurji",
      ingredients: ["4 eggs", "1 onion, chopped", "1 green chilli, chopped", "1 tomato, chopped", "half a tsp ground turmeric", "half a tsp red chilli powder", "1 tbsp oil", "coriander, to garnish"],
      steps: [
        "Fry the onion, chilli and tomato in the oil until soft.",
        "Add the spices, then beat the eggs in and scramble until just set.",
        "Garnish with coriander.",
      ],
    },
    {
      id: "india-butter-chicken",
      name: "Butter Chicken",
      ingredients: ["500 g chicken thigh, cubed", "150 g yoghurt", "1 tbsp ginger garlic paste", "1 tsp garam masala", "1 tsp red chilli powder", "1 onion, chopped", "400 g tin tomatoes", "100 ml double cream", "2 tbsp butter"],
      steps: [
        "Marinate the chicken in the yoghurt, ginger garlic paste and half the spices for at least 30 minutes.",
        "Cook the chicken in a hot pan until browned.",
        "Fry the onion in the butter, add the tomatoes and the rest of the spices, and simmer for 10 minutes. Blend and strain.",
        "Return the chicken to the sauce, add the cream, and simmer until cooked through.",
      ],
    },
  ],
  Poland: [
    {
      id: "poland-barszcz",
      name: "Barszcz (Beetroot Soup, Vegetarian)",
      ingredients: ["500 g beetroot, grated", "1 carrot, chopped", "1 onion, chopped", "1 litre vegetable stock", "1 tbsp vinegar", "1 tsp sugar", "1 bay leaf", "salt and black pepper"],
      steps: [
        "Simmer the beetroot, carrot, onion and bay leaf in the stock for 30 minutes.",
        "Add the vinegar and sugar, then strain.",
        "Season and serve hot.",
      ],
    },
    {
      id: "poland-pierogi",
      name: "Potato and Cheese Pierogi",
      ingredients: ["300 g plain flour", "1 egg", "120 ml water", "pinch of salt", "300 g potatoes, boiled and mashed", "100 g cottage or farmer's cheese", "1 onion, fried", "butter, to serve"],
      steps: [
        "Knead the flour, egg, water and salt into a smooth dough, rest 30 minutes.",
        "Mix the potato, cheese and half the onion for the filling.",
        "Roll the dough thin, cut rounds, add filling, fold and seal.",
        "Boil for 3 minutes, then fry in butter with the rest of the onion.",
      ],
    },
    {
      id: "poland-mizeria",
      name: "Mizeria",
      ingredients: ["2 cucumbers, thinly sliced", "150 ml sour cream", "1 tsp salt", "1 tsp sugar", "1 tbsp chopped dill", "1 tsp lemon juice"],
      steps: [
        "Salt the cucumber and leave for 10 minutes, then squeeze out the water.",
        "Mix with the sour cream, sugar, dill and lemon juice.",
        "Chill before serving.",
      ],
    },
    {
      id: "poland-kotlet-schabowy",
      name: "Kotlet Schabowy (Breaded Pork Cutlet)",
      ingredients: ["4 pork loin cutlets", "50 g plain flour", "1 egg, beaten", "100 g breadcrumbs", "oil for frying", "salt and black pepper"],
      steps: [
        "Beat the cutlets thin and season.",
        "Coat in flour, egg and breadcrumbs.",
        "Fry in hot oil for 3 to 4 minutes each side until golden and cooked through.",
      ],
    },
    {
      id: "poland-bigos",
      name: "Bigos (Hunter's Stew)",
      ingredients: ["300 g sauerkraut", "300 g pork shoulder, cubed", "150 g smoked sausage, sliced", "1 onion, chopped", "2 tbsp oil", "200 ml water", "1 bay leaf", "pinch of juniper berries"],
      steps: [
        "Brown the pork and onion in the oil.",
        "Add the sauerkraut, water, bay and juniper and simmer for 90 minutes.",
        "Add the sausage for the last 30 minutes.",
      ],
    },
  ],
  "United States": [
    {
      id: "us-clam-chowder",
      name: "New England Clam Chowder",
      ingredients: ["250 g clams, fresh or tinned, chopped", "2 rashers bacon, diced", "1 onion, chopped", "2 potatoes, diced", "300 ml fish or chicken stock", "300 ml milk", "150 ml double cream", "1 tbsp plain flour", "1 tbsp butter"],
      steps: [
        "Fry the bacon and onion in the butter until soft.",
        "Stir in the flour, then the stock and potatoes, and simmer until the potatoes are tender.",
        "Add the milk, cream and clams and warm gently without boiling.",
      ],
    },
    {
      id: "us-texas-chili",
      name: "Texas Chili",
      ingredients: ["500 g beef mince", "1 onion, chopped", "2 garlic cloves, minced", "400 g tin kidney beans, drained", "400 g tin chopped tomatoes", "2 tbsp chilli powder", "1 tsp ground cumin", "1 tsp dried oregano", "200 ml water"],
      steps: [
        "Brown the beef with the onion and garlic.",
        "Stir in the spices, then the tomatoes, beans and water.",
        "Simmer for 45 minutes, stirring now and then.",
      ],
    },
    {
      id: "us-mac-and-cheese",
      name: "Baked Mac and Cheese",
      ingredients: ["250 g macaroni", "40 g butter", "40 g plain flour", "500 ml milk", "200 g cheddar, grated", "1 tsp mustard powder", "salt"],
      steps: [
        "Boil the macaroni until just tender and drain.",
        "Make a roux with the butter and flour, then whisk in the milk until thick.",
        "Stir in the cheddar and mustard, then the pasta. Bake at 180°C for 15 minutes if you want a crust.",
      ],
    },
    {
      id: "us-corn-on-the-cob",
      name: "Corn on the Cob with Herb Butter",
      ingredients: ["4 corn cobs", "50 g butter, softened", "1 tbsp chopped parsley", "1 tsp lime juice", "salt and black pepper"],
      steps: [
        "Boil the corn for 5 to 7 minutes, or grill it until charred in places.",
        "Mix the butter with the parsley, lime juice and seasoning.",
        "Spread over the hot corn.",
      ],
    },
    {
      id: "us-buttermilk-pancakes",
      name: "Buttermilk Pancakes",
      ingredients: ["200 g plain flour", "2 tbsp sugar", "2 tsp baking powder", "half a tsp salt", "2 eggs", "300 ml buttermilk", "3 tbsp melted butter"],
      steps: [
        "Whisk the flour, sugar, baking powder and salt together.",
        "Whisk the eggs, buttermilk and butter, then fold into the dry ingredients without over-mixing.",
        "Pour ladlefuls onto a hot greased pan and flip when bubbles pop on the surface.",
      ],
    },
  ],
};

/** Stable id for a built-in dish, used as the meal id on the recipes page. */
export const localRecipeId = (recipe: LocalRecipe) => `local-${recipe.id}`;

const BY_ID = new Map<string, { country: string; recipe: LocalRecipe }>(
  Object.entries(LOCAL_RECIPES).flatMap(([country, recipes]) =>
    recipes.map((recipe) => [localRecipeId(recipe), { country, recipe }] as const)
  )
);

export function findLocalRecipe(id: string): { country: string; recipe: LocalRecipe } | null {
  return BY_ID.get(id) ?? null;
}

/** The diet read from the ingredients, the same way the rest of the app reads a dish. */
export function localRecipeDiet(recipe: LocalRecipe): ItemDietType {
  return getItemDietType(recipe.ingredients.join(", "));
}

/**
 * Shaped like a TheMealDB lookup row, so the recipes page renders built-in
 * dishes with the same code path as the rest.
 */
export function localRecipeDetail(country: string, recipe: LocalRecipe): Record<string, string> {
  const detail: Record<string, string> = {
    idMeal: localRecipeId(recipe),
    strMeal: recipe.name,
    strCategory: "Our kitchen",
    strArea: country,
    strInstructions: recipe.steps.join("\n\n"),
    strMealThumb: "",
  };
  recipe.ingredients.forEach((ingredient, i) => {
    detail[`strIngredient${i + 1}`] = ingredient;
    detail[`strMeasure${i + 1}`] = "";
  });
  return detail;
}
