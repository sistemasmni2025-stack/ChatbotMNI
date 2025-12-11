import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import soap from 'soap';

const welcomeNietoImage = join(process.cwd(), 'assets', 'nieto_welcome.jpg');
const tireInfoNietoImage = join(process.cwd(), 'assets', 'nieto_tireinfo.png');

const MENU_OPTIONS = {
    COTIZAR_LLANTA: '🛞 Cotizar Llanta(s)',
    SEGUIMIENTO_COTIZACION: '👨‍💻 Seguimiento de Cotización',
    CONTACTAR_ASESOR: '📋 Contactar Asesor'
};

const PORT = process.env.PORT ?? 3008

const idleFlow = addKeyword(utils.setEvent('IDLE'))
    .addAnswer('⏳ Se ha cerrado la sesión por inactividad. ¡Gracias por visitarnos! Si necesitas algo más, escribe "Hola".');

/*const discordFlow = addKeyword('doc').addAnswer(
    ['You can see the documentation here', '📄 https://builderbot.app/docs \n', 'Do you want to continue? *yes*'].join(
        '\n'
    ),
    { capture: true },
    async (ctx, { gotoFlow, flowDynamic }) => {
        if (ctx.body.toLocaleLowerCase().includes('yes')) {
            return gotoFlow(registerFlow)
        }
        await flowDynamic('Thanks!')
        return
    }
)*/

const welcomeFlow = addKeyword(['hola', 'hi', 'menu', 'inicio'])
    .addAnswer('¡Bienvenid@ al Chatbot 🤖 de MultillantasNieto!', {
        media: welcomeNietoImage
    })
    .addAnswer(
        [
            'Selecciona una opción:',
            `1. ${MENU_OPTIONS.COTIZAR_LLANTA}`,
            `2. ${MENU_OPTIONS.SEGUIMIENTO_COTIZACION}`,
            `3. ${MENU_OPTIONS.CONTACTAR_ASESOR}`
        ].join('\n'),
        {
            buttons: [
                { body: MENU_OPTIONS.COTIZAR_LLANTA },
                { body: MENU_OPTIONS.SEGUIMIENTO_COTIZACION },
                { body: MENU_OPTIONS.CONTACTAR_ASESOR }
            ],
            capture: true
        },
        async (ctx, { gotoFlow, fallBack }) => {
            const body = ctx.body.trim();

            const isMatch = (input, option, number) => {
                return input === option || input === number;
            };

            if (isMatch(body, MENU_OPTIONS.COTIZAR_LLANTA, '1')) {
                return gotoFlow(nietoFlow);
            } else if (isMatch(body, MENU_OPTIONS.SEGUIMIENTO_COTIZACION, '2')) {
                return gotoFlow(seguimientoFlow);
            } else if (isMatch(body, MENU_OPTIONS.CONTACTAR_ASESOR, '3')) {
                return fallBack('Un asesor se pondrá en contacto contigo pronto. (Funcionalidad en desarrollo)');
            } else {
                return fallBack('Por favor, Selecciona una Opción Válida (1, 2 o 3).');
            }
        }
    )

/*const registerFlow = addKeyword(utils.setEvent('REGISTER_FLOW'))
    .addAnswer(`¿Cúal es tu nombre??`, { capture: true }, async (ctx, { state }) => {
        await state.update({ name: ctx.body })
    })
    .addAnswer('¿Cúal es tu edad??', { capture: true }, async (ctx, { state }) => {
        await state.update({ age: ctx.body })
    })
    .addAction(async (_, { flowDynamic, state }) => {
        await flowDynamic(`${state.get('name')}, thanks for your information!: Your age: ${state.get('age')}`)
    })*/

const fullSamplesFlow = addKeyword(['samples', utils.setEvent('SAMPLES')])
    .addAnswer(`💪 I'll send you a lot files...`)
    .addAnswer(`Send image from Local`, { media: join(process.cwd(), 'assets', 'sample.png') })
    .addAnswer(`Send video from URL`, {
        media: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTJ0ZGdjd2syeXAwMjQ4aWdkcW04OWlqcXI3Ynh1ODkwZ25zZWZ1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LCohAb657pSdHv0Q5h/giphy.mp4',
    })
    .addAnswer(`Send audio from URL`, { media: 'https://cdn.freesound.org/previews/728/728142_11861866-lq.mp3' })
    .addAnswer(`Send file from URL`, {
        media: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    })

// --- FLUJO MULTILLANTAS NIETO ---


async function getTireInventoryFromAPI(txt, tipo) {
    const noper = 1;
    // tipo: 1=Descripcion, 2=MSPN, 3=Medida
    const url = `https://sys.multillantasnieto.net/ExistenciasAPI/APIBot/SP_ChatBot?Noper=${noper}&Txt=${encodeURIComponent(txt)}&Tipo=${tipo}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Error en la respuesta de la API');
        }
        const data = await response.json();

        // La API devuelve un objeto con la propiedad "SDTExistencias" que contiene el array
        const existencias = data?.SDTExistencias;

        if (!Array.isArray(existencias) || existencias.length === 0) {
            return null;
        }
        // Retorna los datos de existencias
        return existencias;
    } catch (error) {
        console.error('Error consultando la API:', error);
        return null;
    }
}

const selectionFlow = addKeyword(['SELECTION_FLOW'])
    .addAnswer('¿Deseas cotizar alguna de estas opciones? Responde con el *Número de opción* (ej: 1) o escribe *"No"* para buscar otra llanta.', { capture: true, idle: 120000 }, async (ctx, { state, gotoFlow, fallBack, flowDynamic }) => {
        if (ctx?.idleFallBack) return gotoFlow(idleFlow);

        const input = ctx.body.trim().toLowerCase();

        if (input.includes('no')) {
            return gotoFlow(nietoFlow);
        }

        const index = parseInt(input) - 1;
        const results = state.get('searchResults');

        if (isNaN(index) || index < 0 || index >= results.length) {
            return fallBack('⚠️ Opción no válida. Por favor, escribe solo el número de la opción (ej: 1).');
        }

        const selectedTire = results[index];
        await state.update({ selectedTire });

        await flowDynamic([
            'Has seleccionado:',
            `🔹 Marca: ${selectedTire.grumar}`,
            `🔹 Medida: ${selectedTire.almancho} ${selectedTire.almserie} ${selectedTire.almrin}`,
            `🔹 Descripción: ${selectedTire.almnom}`,
            '-----------------------------',
            '¿Es correcta esta opción? (Sí/No)'
        ].join('\n'));
    })
    .addAnswer('Confirmación', { capture: true, idle: 120000 }, async (ctx, { state, flowDynamic, gotoFlow, fallBack }) => {
        if (ctx?.idleFallBack) return gotoFlow(idleFlow);

        const input = ctx.body.trim().toLowerCase();
        const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (input === 'si' || normalize(input) === 'si') {
            const folio = `COT-${Date.now().toString().slice(-6)}`;
            const selectedTire = state.get('selectedTire');

            await flowDynamic([
                `✅ *¡Solicitud de Cotización Recibida!*`,
                `📄 Tu folio de seguimiento es: *${folio}*`,
                `🔧 Llanta: ${selectedTire.grumar} ${selectedTire.almancho}/${selectedTire.almserie}R${selectedTire.almrin}`,
                `🕒 Tu cotización ha sido puesta en lista de espera. Un asesor verificará la disponibilidad y te contactará en breve.`
            ].join('\n'));

            // Aquí se enviaría la notificación al asesor (pendiente de implementar)
        } else if (input === 'no') {
            return gotoFlow(selectionFlow); // Vuelve a preguntar si desea cotizar alguna opción
        } else {
            return fallBack('⚠️ Por favor, responde Sí o No.');
        }
    });

const nietoFlow = addKeyword(['cotizar', 'llanta', 'multillantasnieto'])
    .addAnswer('¿Cómo deseas buscar tu llanta?\n\n1. Descripción (Ej.Michelin,uniroyal,etc)\n2. MSPN (Ej.3953)\n3. Medida (Ej.155 70 13)', {
        buttons: [
            { body: 'Descripción' },
            { body: 'MSPN' },
            { body: 'Medida' }
        ],
        capture: true,
        idle: 120000
    }, async (ctx, { state, fallBack, gotoFlow }) => {
        if (ctx?.idleFallBack) return gotoFlow(idleFlow);

        const selection = ctx.body.trim().toLowerCase();
        const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        let tipo = null;

        if (selection === '1' || normalize(selection).includes('descripcion')) tipo = 1;
        else if (selection === '2' || selection.includes('mspn')) tipo = 2;
        else if (selection === '3' || selection.includes('medida')) tipo = 3;

        if (!tipo) {
            return fallBack('⚠️ Por favor, selecciona una opción válida (1, 2 o 3).');
        }

        await state.update({ searchType: tipo });
    })
    .addAnswer('✍️ Por favor, ingresa el dato de búsqueda:', { capture: true, idle: 120000 }, async (ctx, { flowDynamic, state, gotoFlow }) => {
        if (ctx?.idleFallBack) return gotoFlow(idleFlow);

        const query = ctx.body.trim();
        const tipo = state.get('searchType');

        await flowDynamic('🔍 Buscando existencias...');
        const results = await getTireInventoryFromAPI(query, tipo);

        if (!results) {
            await flowDynamic('❌ No se encontraron llantas con esos datos. Intenta nuevamente.');
            return gotoFlow(nietoFlow);
        }

        await state.update({ searchResults: results });

        // Formatear resultados para mostrar
        const resultsText = results.map((item, idx) =>
            `Opción ${idx + 1}:\nClave: ${item.almcve}\nMarca: ${item.grumar}\nMedida: ${item.almancho} ${item.almserie} ${item.almrin}\nDescripción: ${item.almnom}`
        ).join('\n\n');

        await flowDynamic('🚗 *Resultados de la búsqueda:*');
        await flowDynamic(resultsText);

        return gotoFlow(selectionFlow);
    })

// --- FLUJO SEGUIMIENTO DE COTIZACIÓN ---
const seguimientoFlow = addKeyword(['seguimiento', '2'])
    .addAnswer('🔎 Seguimiento de Cotización')
    .addAnswer(
        [
            'Por favor, ingresa el número de tu cotización o tu número de teléfono registrado:',
            'Ejemplo: 4421234567 o COT12345'
        ].join('\n'),
        { capture: true },
        async (ctx, { flowDynamic }) => {
            const dato = ctx.body.trim();
            // Aquí deberías consultar la API de seguimiento si existe
            // Por ahora, solo se simula la respuesta
            if (/^\d{10}$/.test(dato)) {
                await flowDynamic('Buscando cotizaciones asociadas al número: ' + dato + '...');
                await flowDynamic('Cotización encontrada: COT12345\nEstado: Pendiente de confirmación\nFecha: 2025-12-02');
            } else if (/^COT\d+$/i.test(dato)) {
                await flowDynamic('Buscando cotización con folio: ' + dato + '...');
                await flowDynamic('Cotización encontrada: ' + dato + '\nEstado: Pendiente de confirmación\nFecha: 2025-12-02');
            } else {
                await flowDynamic('No se encontró información con el dato proporcionado. Verifica e intenta nuevamente.');
            }
        }
    );

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, fullSamplesFlow, nietoFlow, selectionFlow, seguimientoFlow, idleFlow])

    const adapterProvider = createProvider(Provider,
        { version: [2, 3000, 1027934701] }
    )
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('REGISTER_FLOW', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('SAMPLES', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    httpServer(+PORT)
}

main()
