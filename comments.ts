// ============================================================================
// ИНИЦИАЛИЗАЦИЯ И ИНСТРУМЕНТЫ
// ============================================================================

// Достаем математические инструменты из библиотеки glMatrix
const { mat4, mat3, vec3, vec4 } = glMatrix;

const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

let lastTime = 0;   // Время предыдущего кадра для расчета delta time
let triangle;       // Переменная для нашего объекта треугольника
let rotation = 0;   // Текущий угол поворота треугольника в радианах

// ГЛОБАЛЬНЫЕ БУФЕРЫ ПАМЯТИ (Аллоцируем один раз при старте, чтобы не мучить GC в render)
const modelMatrix = mat4.create();       // Локальные координаты -> Мировые
const viewMatrix = mat4.create();        // Мировые -> Координаты камеры
const projectionMatrix = mat4.create();  // Камера -> Clip Space (перспектива)
const viewProjMatrix = mat4.create();    // Вспомогательная матрица (Projection * View)
const mvpMatrix = mat4.create();         // Финальная супер-матрица (Projection * View * Model)

// Буферы для оптимизации расчетов внутри отрисовки (класса Triangle)
const tempNormalMatrix = mat3.create();      // Матрица вращения нормалей 3х3
const tempTransformedNormal = vec3.create(); // Нормаль после поворота в мире
const tempViewDir = vec3.create();           // Вектор направления от объекта к камере
const triangleWorldPos = vec3.create();      // Мировая позиция центра объекта
const tempClipVec4 = vec4.create();          // Буфер для 4D координат в Clip Space

// НАСТРОЙКА СЦЕНЫ (Свет и Камера)
const globalLightDirection = vec3.fromValues(0, 0, 1); // Направление бесконечного источника света
vec3.normalize(globalLightDirection, globalLightDirection); // Приводим к длине 1

const eye = vec3.fromValues(0, 0, 0);     // Позиция камеры в мире (в центре)
const center = vec3.fromValues(0, 0, -1);  // Точка, куда камера смотрит (вглубь экрана)
const up = vec3.fromValues(0, 1, 0);      // Вектор "верх" для камеры (голова не наклонена)

// ============================================================================
// ГЕОМЕТРИЧЕСКИЕ КЛАССЫ
// ============================================================================

class Vertex {
    constructor(x, y, z) {
        this.x = x; // Локальная координата X
        this.y = y; // Локальная координата Y
        this.z = z; // Локальная координата Z
    }
}

class Triangle {
    constructor() {
        // Три вершины треугольника в его локальном пространстве (вокруг его собственного центра)
        this.vertices = [
            new Vertex(0, 1, 0),
            new Vertex(1, 0, 0),
            new Vertex(-1, 0, 0)
        ];

        // Вектор «лица» треугольника. Изначально смотрит прямо на нас (вдоль оси Z)
        this.normal = vec3.fromValues(0, 0, 1);
    }

    draw(mvpMatrix, modelMatrix, cameraEye, lightDir) {
        // ШАГ 1: Трансформируем нормаль треугольника в мировое пространство
        // Извлекаем из 4х4 матрицы модели только вращение 3х3 (чтобы сдвиг на -5 метров не ломал вектор)
        mat3.fromMat4(tempNormalMatrix, modelMatrix);
        // Умножаем локальную нормаль на матрицу вращения
        vec3.transformMat3(tempTransformedNormal, this.normal, tempNormalMatrix);
        vec3.normalize(tempTransformedNormal, tempTransformedNormal); // Гарантируем длину вектора = 1

        // ШАГ 2: Честный расчет Backface Culling (Отсечение задних граней)
        // Достаем мировую позицию треугольника из его матрицы модели (это элементы 12, 13, 14)
        vec3.set(triangleWorldPos, modelMatrix, modelMatrix, modelMatrix);
        // Находим вектор взгляда от треугольника к камере: Направление = ПозицияКамеры - ПозицияОбъекта
        vec3.subtract(tempViewDir, cameraEye, triangleWorldPos);
        vec3.normalize(tempViewDir, tempViewDir);

        // Скалярное произведение нормали и направления на камеру
        let cameraDot = vec3.dot(tempTransformedNormal, tempViewDir);
        if (cameraDot <= 0) {
            return; // Треугольник повернут спиной или ребром — МГНОВЕННО выходим, не тратя ресурсы!
        }

        // ШАГ 3: Расчет освещения (Закон Ламберта)
        // Скалярное произведение мировой нормали и направления света
        let lightDot = vec3.dot(tempTransformedNormal, lightDir);
        let brightness = Math.max(0, lightDot); // Ограничиваем снизу нулем, чтобы не было "отрицательного" света
        let colorValue = Math.floor(brightness * 255); // Переводим яркость [0..1] в диапазон цветов [0..255]
        let colorString = `rgb(${colorValue}, ${colorValue}, ${colorValue})`;

        // ШАГ 4: Графический конвейер (Превращение 3D-вершин в 2D-пиксели экрана)
        let screenVertices = this.vertices.map(function(vertex) {
            // 1. Локальные координаты превращаем в 4D вектор (добавляем W = 1)
            let localVec4 = vec4.fromValues(vertex.x, vertex.y, vertex.z, 1);

            // 2. Умножаем на супер-матрицу MVP. Получаем координаты в Clip Space (пространство отсечения, пирамида)
            vec4.transformMat4(tempClipVec4, localVec4, mvpMatrix);
            const [x, y, z, w] = tempClipVec4;

            // 3. ПЕРСПЕКТИВНОЕ ДЕЛЕНИЕ: Делим X и Y на W.
            // Пространство схлопывается из пирамиды в идеальный куб NDC (от -1 до 1). Появляется перспектива!
            let ndcX = x / w;
            let ndcY = y / w;

            // 4. Viewport Transform: Переводим координаты из куба [-1..1] в пиксели твоего Canvas
            let screenX = (ndcX + 1) * 0.5 * canvas.logicalWidth;
            let screenY = (-ndcY + 1) * 0.5 * canvas.logicalHeight; // Инвертируем Y, так как в Canvas 2D ноль вверху

            return { x: screenX, y: screenY };
        });

        // ШАГ 5: Отрисовка геометрии на Canvas 2D
        context.beginPath();
        context.moveTo(screenVertices.x, screenVertices.y);
        context.lineTo(screenVertices.x, screenVertices.y);
        context.lineTo(screenVertices.x, screenVertices.y);
        context.closePath();

        context.fillStyle = colorString; // Накатываем посчитанный динамический свет
        context.fill();
    }
}

// ============================================================================
// ИГРОВОЙ ДВИЖОК И СИСТЕМНЫЕ ФУНКЦИИ
// ============================================================================

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;

    canvas.logicalWidth = window.innerWidth;
    canvas.logicalHeight = window.innerHeight;

    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    context.scale(dpr, dpr);

    // Матрица проекции настраивается ОДИН РАЗ при изменении размера экрана, а не каждый кадр
    mat4.perspective(
        projectionMatrix,
        45 * Math.PI / 180, // Угол обзора 45 градусов
        canvas.logicalWidth / canvas.logicalHeight, // Соотношение сторон (Aspect Ratio)
        0.1,   // Ближняя плоскость отсечения (Near)
        100.0  // Дальняя плоскость отсечения (Far)
    );
}

// Инициализируем размеры экрана при старте
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function setup() {
    triangle = new Triangle(); // Создаем наш треугольник
}

function update(dt) {
    if (dt > 0.1) dt = 0.1; // Защита от резких скачков лагов кадров
    rotation += 0.9 * dt;   // Плавно увеличиваем угол поворота на основе дельты времени
}

function render() {
    // Чистим экран черным цветом перед каждым кадром
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.logicalWidth, canvas.logicalHeight);

    if (triangle) {
        // 1. Строим матрицу модели: сначала отодвигаем на 5 единиц вглубь (Z = -5), затем крутим вокруг оси Y
        mat4.fromTranslation(modelMatrix, [0, 0, -5]);
        mat4.rotate(modelMatrix, modelMatrix, rotation,);

        // 2. Строим матрицу камеры (View) на основе параметров глаза, центра взгляда и направления "верх"
        mat4.lookAt(viewMatrix, eye, center, up);

        // 3. Перемножаем матрицы (без выделения памяти!). Порядок строгий: MVP = Projection * View * Model
        mat4.multiply(viewProjMatrix, projectionMatrix, viewMatrix);
        mat4.multiply(mvpMatrix, viewProjMatrix, modelMatrix);

        // 4. Вызываем отрисовку треугольника, передавая все нужные данные из мира
        triangle.draw(mvpMatrix, modelMatrix, eye, globalLightDirection);
    }
}

// Главный бесконечный цикл игры
function gameLoop(currentTime) {
    const dt = (currentTime - lastTime) / 1000; // Считаем, сколько секунд прошло между кадрами
    lastTime = currentTime;

    update(dt); // Обновляем физику/логику
    render();   // Рисуем картинку

    requestAnimationFrame(gameLoop); // Запрашиваем следующий кадр у браузера
}

// Старт движка
setup();
requestAnimationFrame((time) => {
    lastTime = time;
    requestAnimationFrame(gameLoop);
});