import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import soap from 'soap';

const PORT = process.env.PORT ?? 3008

const discordFlow = addKeyword('doc').addAnswer(
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
)

const welcomeFlow = addKeyword(['hola'])
    .addAnswer(`🙌 Hola, bienvenido a *Multillantas Nieto*`)
    .addAnswer(
        [
            '¿En qué puedo ayudarte hoy?',
            'Escribe el número de la opción deseada:',
            '👉 *1*. Cotización',
            '👉 *2*. Seguimiento de Cotización',
            '👉 *3*. Contacto Asesor',
        ].join('\n'),
        { delay: 800, capture: true },
        async (ctx, { gotoFlow, fallBack }) => {
            const body = ctx.body.trim();
            if (body === '1') {
                return gotoFlow(nietoFlow);
            } else if (body === '2') {
                return gotoFlow(seguimientoFlow);
            } else if (body === '3') {
                return fallBack('Un asesor se pondrá en contacto contigo pronto.');
            } else {
                return fallBack('Por favor, selecciona una opción válida (1, 2 o 3).');
            }
        }
    )

const registerFlow = addKeyword(utils.setEvent('REGISTER_FLOW'))
    .addAnswer(`What is your name?`, { capture: true }, async (ctx, { state }) => {
        await state.update({ name: ctx.body })
    })
    .addAnswer('What is your age?', { capture: true }, async (ctx, { state }) => {
        await state.update({ age: ctx.body })
    })
    .addAction(async (_, { flowDynamic, state }) => {
        await flowDynamic(`${state.get('name')}, thanks for your information!: Your age: ${state.get('age')}`)
    })

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
const welcomeNietoImage = join(process.cwd(), 'assets', 'nieto_welcome.jpg');
const tireInfoNietoImage = join(process.cwd(), 'assets', 'nieto_tireinfo.png');

async function getTireInventoryFromAPI(medidas) {
    const wsdlUrl = 'https://sys.multillantasnieto.net/ExistenciasAPI/com.existencias.asp_chatbot?wsdl';
    try {
        const client = await soap.createClientAsync(wsdlUrl);
        // Ajusta el nombre del método y parámetros según el WSDL
        const args = { Medidas: medidas };
        const [result] = await client.GetExistenciasAsync(args);
        // Procesa el resultado para obtener la lista de llantas
        if (result && result.Existencias && Array.isArray(result.Existencias)) {
            return result.Existencias.map((item, idx) =>
                `Opción: ${idx + 1}\nDescripción: ${item.Descripcion}\nPrecio: ${item.Precio}\nExistencia: ${item.Existencia}`
            ).join('\n');
        } else {
            return 'No se encontraron llantas para esas medidas.';
        }
    } catch (error) {
        console.error('Error consultando la API:', error);
        return 'Hubo un error consultando el inventario. Intenta más tarde.';
    }
}

const nietoFlow = addKeyword(['cotizar', 'llanta', 'multillantasnieto'])
    .addAnswer('¡Bienvenid@ al Robot 🤖 de MultillantasNieto!', {
        media: welcomeNietoImage
    })
    .addAnswer('¿Escribe una Opción?', {
        buttons: [
            { body: 'Cotizar' },
            { body: 'Contactar asesor' }
        ]
    })
    .addAnswer(
        '🚗 Escribe las medidas de tu llanta en formato Ancho/Alto/Rin (ej: 185/60R15)\nO envía una foto donde se vean las medidas.\n👉 ¡Te cotizamos al instante!',
        { media: tireInfoNietoImage, capture: true },
        async (ctx, { flowDynamic }) => {
            if (/\d{3}\/\d{2}r\d{2}/i.test(ctx.body)) {
                const medidas = ctx.body.trim();
                const inventoryMsg = await getTireInventoryFromAPI(medidas);
                await flowDynamic('🚗 Estas son las Marcas y Modelos de llantas que tenemos disponibles en nuestro inventario actual:\n' + inventoryMsg);
                await flowDynamic('¿Encontraste la llanta que buscabas? 🕵️‍♂️\n\n✅ Realiza tu pedido al: 442 123 4567\n✅ Compra en nuestra tienda en línea: https://multillantasnieto.com/tienda\n✅ Visita nuestras sucursales: https://multillantasnieto.com/sucursales\nIncluye válvula, montaje, balanceo y nitrógeno (Aplican restricciones)');
                await flowDynamic({ buttons: [ { body: 'Sí' }, { body: 'No' } ], body: '¿Quieres generar un PDF de la cotización anterior?' });
            }
        }
    )

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
    const adapterFlow = createFlow([welcomeFlow, registerFlow, fullSamplesFlow, nietoFlow, seguimientoFlow])
    
    const adapterProvider = createProvider(Provider, 
		{ version: [2, 3000, 1027934701]} 
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
