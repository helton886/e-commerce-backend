import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);
    if (!findCustomer) {
      throw new AppError('Customer not found.');
    }
    const findProducts = await this.productsRepository.findAllById(products);
    if (!findProducts.length) {
      throw new AppError('Products not found');
    }
    // const foundProductsIds = findProducts.map(product => product.id);

    // const checkInexistentProducts = products.filter(
    //   product => !foundProductsIds.includes(product.id),
    // );

    // if (checkInexistentProducts.length) {
    //   throw new AppError(`Product not found: ${checkInexistentProducts[0].id}`);
    // }

    const operationProducts = products.map(product => {
      const findProduct = findProducts.find(p => p.id === product.id);
      if (!findProduct) {
        throw new AppError(`Product not found ${product.id}`);
      }
      if (product.quantity > findProduct.quantity) {
        throw new AppError('Insuficient product quantity');
      }
      return {
        serializedProducts: {
          product_id: product.id,
          quantity: product.quantity,
          price: findProduct.price,
        },
        productsSubtracted: {
          id: findProduct.id,
          quantity: findProduct.quantity - product.quantity,
        },
      };
    });
    const serializedProducts = operationProducts.map(
      serializedProduct => serializedProduct.serializedProducts,
    );
    const productsSubtracted = operationProducts.map(
      serializedProduct => serializedProduct.productsSubtracted,
    );

    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: serializedProducts,
    });

    await this.productsRepository.updateQuantity(productsSubtracted);

    return order;
  }
}

export default CreateOrderService;
