const Subscription = {
  game: {
    subscribe: async (parent, args, ctx) => {
      return ctx.db.subscription.game({
        AND: [
          { mutation_in: ["UPDATED"] },
          {
            where: {
              node: {
                id: args.where.node.id
              }
            }
          }
        ]
      });
    }
  },
  gameEvent: {
    subscribe: async (parent, args, ctx) => {
      return await ctx.db.subscription.gameEvent({
        AND: [
          { where: { mutation_in: ["CREATED"] } },
          {
            node: {
              game: {
                id: args.gameId
              }
            }
          }
        ]
      });
    }
  }
};

module.exports = Subscription;
