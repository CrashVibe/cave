import { Context, Schema } from 'koishi';
import { applyModel } from './model';
import {} from '@u1bot/koishi-plugin-coin/src';
import { add_cave } from './data_source';
import {} from 'koishi-plugin-adapter-onebot';
export const name = 'cave';

export const inject = ['database', 'coin'];
export interface Config {
    managers: Array<string>;
}

export const Config: Schema<Config> = Schema.object({
    managers: Schema.array(Schema.string()).description('管理者列表').required().default([])
});

export async function apply(ctx: Context, config: Config) {
    applyModel(ctx);
    ctx.command('add_cave <content>', '添加内容到回声洞')
        .alias('投稿')
        .alias('回声洞投稿')
        .action(async ({ session }, content) => {
            return await add_cave(ctx, session, config, content, false);
        });

    ctx.command('add_anonymous_cave <content:text>', '匿名添加内容到回声洞')
        .alias('匿名投稿')
        .alias('匿名回声洞投稿')
        .action(async ({ session }, content) => {
            return await add_cave(ctx, session, config, content, true);
        });

    ctx.command('cave', '随机查看一个洞穴秘密')
        .alias('回声洞')
        .action(async () => {
            const list = await ctx.database.get('cave', {});
            if (!list.length) {
                return '洞穴里还没有秘密';
            }
            const item = list[Math.floor(Math.random() * list.length)];
            return item.content;
        });
    ctx.command('remove_cave <id> [reason:text]', '删除指定的洞穴秘密')
        .alias('删除回声洞')
        .alias('删除')
        .action(async ({ session }, id, reason) => {
            const cave_query = await ctx.database.get('cave', id);
            if (!cave_query || cave_query.length === 0) {
                return '没有找到对应的回声洞内容诶~';
            }
            const cave = cave_query[0];
            const isManager = config.managers.includes(session.userId);
            const isAuthor = session.userId === cave.user_id;
            if (!isManager && !isAuthor) {
                return '你没有权限删除这个回声洞内容~';
            }
            await ctx.database.remove('cave', id);
            if (isManager && !isAuthor) {
                const deleteReason = reason || '管理员删除';
                await session.bot.sendPrivateMessage(
                    cave.user_id,
                    `你的回声洞投稿（编号 ${cave.id}）已被管理员删除。\n原因：${deleteReason}\n内容：\n————————————\n${cave.content}`
                );
                return `[删除成功] 编号 ${cave.id} 的投稿已删除\n内容：\n————————————\n${cave.content}\n已通知作者。`;
            }
            return '[删除成功] 编号 ' + cave.id + ' 的投稿已删除\n内容：\n————————————\n' + cave.content;
        });
    ctx.command('cave_history', '回声洞投稿历史')
        .alias('回声洞记录')
        .action(async ({ session }) => {
            const list = await ctx.database.get('cave', { user_id: session.userId });
            if (!list.length) {
                return '你还没有投稿过回声洞哦~';
            }
            list.sort((a, b) => b.id - a.id);
            const msgList = list.map((item) => `编号：${item.id}\n内容：\n————————————\n${item.content}`);
            if (session.platform === 'onebot') {
                const nodeList = msgList.map((text) => ({
                    type: 'node',
                    data: {
                        user_id: session.userId,
                        nickname: session.username || '你',
                        content: text
                    }
                }));
                if (session.onebot.group_id) {
                    await session.onebot.sendGroupForwardMsg(session.onebot.group_id, nodeList);
                    return;
                } else {
                    await session.onebot.sendPrivateForwardMsg(session.onebot.user_id, nodeList);
                    return;
                }
            }
            return msgList.join('\n\n');
        });
}
