const { forwardTo } = require("prisma-binding");

const Query = {
  games: forwardTo("db"),
  game: forwardTo("db"),
  me(parent, args, ctx, info) {
    if (!ctx.request.userId) return null;
    return ctx.db.query.user(
      {
        where: { id: ctx.request.userId }
      },
      info
    );
  },
  usersByUsername(parent, { searchValue }, ctx, info) {
    return ctx.db.query.users(
      {
        where: {
          AND: [
            { username_contains: searchValue },
            { id_not: ctx.request.userId }
          ]
        }
      },
      info
    );
  }
};

module.exports = Query;
