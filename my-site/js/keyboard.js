window.onload = () => {
    const STANDARD_FLASH_PROBABILITY = 15;
    const FAST_FLASH_PROBABILITY = 1;
    const keys = [].slice.call(document.getElementsByClassName("keyboard-key"));
    const colors = [
        "#ff6565",
        "#ffc7c7",
        "#aeb6ff",
        "#a1ffa2",
        "#e79aff",
        "#ffce9a",
        "#7a7eff",
        "#50ffdc",
    ]
    let flashProbability = STANDARD_FLASH_PROBABILITY;

    function randomRange(number) {
        return Math.floor(Math.random() * number);
    }

    function keyboardMouseOver() {
        if (!!document.getElementById("keyboard").querySelector(":hover")) {
            flashProbability = FAST_FLASH_PROBABILITY
        } else {
            flashProbability = STANDARD_FLASH_PROBABILITY
        }
    }

    setInterval(() => {
        if (randomRange(flashProbability) === 0 && keys.length > 0) {
            let rand = randomRange(keys.length - 1);
            let key = keys.splice(rand, 1)[0]
            key.style.fill = colors[rand % colors.length]
            let animation = key.animate([
                {opacity: 0},
                {opacity: 1},
                {opacity: 0}
            ], {
                duration: 1000,
            })
            animation.onfinish = () => {
                if (!keys.includes(key)) return keys.push(key);
            }
        }
    }, 100)

    document.addEventListener("mousemove", keyboardMouseOver)
}
