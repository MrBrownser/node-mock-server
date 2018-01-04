// @flow

import path from 'path';

import log from 'node-mock-server-log';
import {decode} from 'node-mock-server-uuid';
import {readDir, writeDir, removeDir, isDir, writeFile, isFile, toMethodEnum, is} from 'node-mock-server-utils';
import Method from '../Method';

import type {
	EndpointConstructorType,
	EndpointJsonType,
	EndpointDetailedJsonType,
	MethodJsonType,
	MethodCreateDataType,
} from '../../node-mock-server-api.js.flow';

class Endpoint {
	src: string;
	endpoint: string;
	endpointId: string;
	methods: Array<Method> = [];
	methodsById: {[key: string]: Method} = {};

	constructor({endpointId, src}: EndpointConstructorType) {
		this.src = src;
		this.endpoint = decode(endpointId);
		this.endpointId = endpointId;

		readDir(path.join(this.src, this.endpointId)).forEach((methodId: string) => {
			this.methodsById[methodId] = new Method({src, endpointId, methodId});
			this.methods.push(this.methodsById[methodId]);
		});
	}

	getMethods = (): Array<Method> => {
		return this.methods;
	};

	getMethod = (methodId: string): Method => {
		return this.methodsById[methodId];
	};

	toJson = (): EndpointJsonType => {
		return {
			endpoint: this.endpoint,
			endpointId: this.endpointId,
			methods: Object.keys(this.methodsById),
		};
	};

	toDetailedJson = (): EndpointDetailedJsonType => {
		return {
			endpoint: this.endpoint,
			endpointId: this.endpointId,
			methods: this.methods.map((method: Method): MethodJsonType => method.toJson()),
		};
	};

	removeMethod = (methodId: string): boolean => {
		const methodInst = this.getMethod(methodId);
		if (!methodInst) {
			return false;
		}

		if (!removeDir(path.join(this.src, this.endpointId, methodId))) {
			return false;
		}

		const index = this.methods.indexOf(this.methodsById[methodId]);
		const methodsArr = [].concat(this.methods);
		methodsArr.splice(index, 1);
		this.methods = methodsArr;
		delete this.methodsById[methodId];
		return true;
	};

	createMethod = ({method, desc = ''}: MethodCreateDataType): ?Method => {
		if (!is.string(method)) {
			log.error(`api: Method string "${method}" is invalid!`);
			return;
		}
		const methodEnum = toMethodEnum(method);

		if (!is.string(methodEnum)) {
			log.error(`api: Method string "${method}" is invalid!`);
			return;
		}

		const pathEndpointMethod = path.join(this.src, this.endpointId, methodEnum);
		const pathEndpointData = path.join(pathEndpointMethod, 'data');
		const pathEndpointStore = path.join(pathEndpointMethod, 'store.json');

		if (isDir(pathEndpointMethod) && isDir(pathEndpointData) && isFile(pathEndpointStore)) {
			log.warn(`api: Method "${method}" in "${this.endpoint}" already exist!`);
			return this.getMethod(methodEnum);
		}

		writeDir(pathEndpointMethod);
		writeDir(pathEndpointData);

		writeDir(pathEndpointData);
		writeFile(path.join(pathEndpointData, '200_empty.json'), '{}');
		writeFile(path.join(pathEndpointData, '200_success.json'), '{}');
		writeFile(path.join(pathEndpointData, '500_error.json'), '{}');
		writeFile(path.join(pathEndpointMethod, 'schema-request.json'), '{}');
		writeFile(path.join(pathEndpointMethod, 'schema-response.json'), '{}');
		writeFile(
			pathEndpointStore,
			JSON.stringify(
				{
					desc,
					desc2: '',
					security: [],
					protected: false,
					status: 'created',
					request: {},
					endpoint: this.endpoint,
					method: methodEnum,
					responses: [
						{
							statusCode: '200',
							schema: {
								type: 'application/json',
							},
						},
					],
				},
				null,
				2
			)
		);

		if (!this.methodsById[methodEnum]) {
			this.methodsById[methodEnum] = new Method({
				src: this.src,
				endpointId: this.endpointId,
				methodId: methodEnum,
			});
			this.methods.push(this.methodsById[methodEnum]);
		}

		return this.getMethod(methodEnum);
	};
}

export default Endpoint;